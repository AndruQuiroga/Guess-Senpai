from __future__ import annotations

import hashlib
import html
import re
from dataclasses import asdict, dataclass
from datetime import date
from typing import List, Optional, Sequence

from ..core.config import Settings, settings
from ..core.database import get_session_factory
from ..services import animethemes, anilist
from ..services.anilist import CoverImage, Media, MediaCharacterEdge, MediaListCollection
from ..services.cache import CacheBackend, get_cache
from ..services.history_repository import (
    list_recent_media as repo_list_recent_media,
    record_recent_media as repo_record_recent_media,
)
from ..services.preferences import load_user_preferences
from .models import (
    AnidleGame,
    AnidleHints,
    AnidlePuzzleBundle,
    CharacterSilhouetteCharacter,
    CharacterSilhouetteGame,
    CharacterSilhouettePuzzleBundle,
    CharacterSilhouetteRound,
    DailyPuzzleResponse,
    GamesPayload,
    GuessOpeningGame,
    GuessOpeningMeta,
    GuessOpeningPuzzleBundle,
    OpeningClip,
    PosterCropStage,
    PosterZoomGame,
    PosterZoomMeta,
    PosterZoomPuzzleBundle,
    RedactedSynopsisGame,
    RedactedSynopsisPuzzleBundle,
    RoundSpec,
    SolutionPayload,
    SolutionStreamingLink,
)

ANIDLE_ROUNDS = [
    RoundSpec(difficulty=1, hints=["genres", "year"]),
    RoundSpec(difficulty=2, hints=["episodes", "popularity", "average_score"]),
    RoundSpec(difficulty=3, hints=["duration", "tags"]),
]

POSTER_ROUNDS = [
    RoundSpec(difficulty=1, hints=[]),
    RoundSpec(difficulty=2, hints=["genres"]),
    RoundSpec(difficulty=3, hints=["year", "format"]),
]

SYNOPSIS_ROUNDS = [
    RoundSpec(difficulty=1, hints=["unmask:1"]),
    RoundSpec(difficulty=2, hints=["unmask:3"]),
    RoundSpec(difficulty=3, hints=["unmask:6"]),
]

OPENING_ROUNDS = [
    RoundSpec(difficulty=1, hints=["length", "season"]),
    RoundSpec(difficulty=2, hints=["artist"]),
    RoundSpec(difficulty=3, hints=["song", "sequence"]),
]

CHARACTER_SILHOUETTE_ROUNDS = [
    CharacterSilhouetteRound(
        difficulty=1,
        label="Silhouette",
        filter="brightness(0) saturate(0) contrast(180%) blur(12px)",
        description="Shadow outline only",
    ),
    CharacterSilhouetteRound(
        difficulty=2,
        label="Spotlight",
        filter="brightness(0.45) saturate(120%) blur(6px)",
        description="Soft lighting begins to reveal features",
    ),
    CharacterSilhouetteRound(
        difficulty=3,
        label="Full reveal",
        filter="none",
        description="Complete character artwork",
    ),
]

STREAMING_SITES = {
    "Amazon Prime Video",
    "Bilibili",
    "Crunchyroll",
    "Disney+",
    "Funimation",
    "HIDIVE",
    "Hulu",
    "Netflix",
    "YouTube",
}

PUZZLE_CACHE_PREFIX = "guesssenpai:puzzle"
USER_HISTORY_KEY_TEMPLATE = "guesssenpai:user-history:{user_id}"

@dataclass
class UserContext:
    user_id: int
    username: Optional[str]
    access_token: str


async def _get_cache() -> CacheBackend:
    return await get_cache(settings.redis_url)


def _strip_html(text: str) -> str:
    stripped = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    stripped = re.sub(r"<[^>]+>", " ", stripped)
    return html.unescape(stripped)


def _title_variants(media: Media) -> List[str]:
    titles = [
        media.title.english,
        media.title.romaji,
        media.title.native,
        media.title.userPreferred,
    ]
    titles.extend(media.synonyms or [])
    return [t for t in titles if t]


def _choose_answer(media: Media) -> str:
    titles = [
        media.title.english,
        media.title.romaji,
        media.title.native,
        media.title.userPreferred,
    ]
    for title in titles:
        if title:
            return title
    return "Unknown"


def _extract_top_tags(media: Media, limit: int = 6) -> List[str]:
    tags: List[tuple[int, str]] = []
    for tag in media.tags or []:
        if not tag or not tag.name:
            continue
        if getattr(tag, "isGeneralSpoiler", False):
            continue
        rank = tag.rank if tag.rank is not None else 10_000
        tags.append((rank, tag.name))
    tags.sort(key=lambda item: item[0])
    return [name for _, name in tags[:limit]]


def _build_anidle(media: Media) -> AnidleGame:
    hints = AnidleHints(
        genres=[g for g in media.genres if g],
        tags=_extract_top_tags(media),
        year=media.seasonYear or (media.startDate or {}).get("year"),
        episodes=media.episodes,
        duration=media.duration,
        popularity=media.popularity,
        average_score=media.averageScore,
    )
    return AnidleGame(spec=ANIDLE_ROUNDS, answer=_choose_answer(media), hints=hints)


def _offset_from_digest(digest: bytes, index: int, margin: float) -> tuple[float, float]:
    start = (index * 4) % len(digest)
    chunk = digest[start : start + 4]
    if len(chunk) < 4:
        chunk = (chunk + digest)[:4]
    raw_x = int.from_bytes(chunk[:2], "big") / 65535
    raw_y = int.from_bytes(chunk[2:], "big") / 65535
    lower = margin * 100.0
    upper = 100.0 - lower
    span = max(upper - lower, 0.0)
    offset_x = lower + raw_x * span
    offset_y = lower + raw_y * span
    return offset_x, offset_y


def _build_poster_crop_stages(media: Media) -> List[PosterCropStage]:
    cover = media.coverImage
    image_ref = ""
    if cover:
        image_ref = (
            getattr(cover, "extraLarge", None)
            or getattr(cover, "large", None)
            or getattr(cover, "medium", None)
            or ""
        )
    seed = f"poster:{media.id}:{image_ref}"
    digest = hashlib.sha256(seed.encode("utf-8")).digest()
    scales = [1.65, 1.25, 1.0]
    stages: List[PosterCropStage] = []
    for index, scale in enumerate(scales):
        if index == len(scales) - 1:
            stages.append(PosterCropStage(scale=1.0, offset_x=50.0, offset_y=50.0))
            continue
        margin = 0.22 if index == 0 else 0.12
        offset_x, offset_y = _offset_from_digest(digest, index, margin)
        stages.append(PosterCropStage(scale=scale, offset_x=offset_x, offset_y=offset_y))
    return stages


def _build_poster(media: Media) -> PosterZoomGame:
    cover = media.coverImage or CoverImage()
    image = (
        getattr(cover, "extraLarge", None)
        or getattr(cover, "large", None)
        or getattr(cover, "medium", None)
    )
    meta = PosterZoomMeta(
        genres=[g for g in media.genres if g],
        year=media.seasonYear or (media.startDate or {}).get("year"),
        format=media.format,
    )
    return PosterZoomGame(
        spec=POSTER_ROUNDS,
        answer=_choose_answer(media),
        image=image,
        meta=meta,
        cropStages=_build_poster_crop_stages(media),
    )


def _redact_description(media: Media) -> tuple[str, List[str]]:
    if not media.description:
        return "", []
    clean_text = _strip_html(media.description)
    variants = _title_variants(media)
    masked_tokens: List[str] = []
    redacted = clean_text
    for variant in sorted(set(variants), key=len, reverse=True):
        escaped = re.escape(variant)
        pattern = re.compile(rf"(?i)\b{escaped}\b")
        if pattern.search(redacted):
            masked_tokens.append(variant)
        redacted = pattern.sub("[REDACTED]", redacted)
    # Collapse extra whitespace created by substitutions.
    redacted = re.sub(r"\s{2,}", " ", redacted)
    return redacted.strip(), masked_tokens


def _build_synopsis(media: Media) -> RedactedSynopsisGame:
    text, masked_tokens = _redact_description(media)
    return RedactedSynopsisGame(
        spec=SYNOPSIS_ROUNDS,
        answer=_choose_answer(media),
        text=text,
        masked_tokens=masked_tokens,
    )


def _normalize_role(role: Optional[str]) -> Optional[str]:
    if not role:
        return None
    normalized = role.replace("_", " ").strip()
    if not normalized:
        return None
    return normalized.title()


def _available_character_edges(media: Media) -> List[MediaCharacterEdge]:
    if not media.characters or not media.characters.edges:
        return []
    edges: List[MediaCharacterEdge] = []
    for edge in media.characters.edges:
        if not edge or not edge.node:
            continue
        image = edge.node.image
        if not image:
            continue
        if not (image.large or image.medium):
            continue
        edges.append(edge)
    return edges


def _select_character_edge(media: Media) -> Optional[MediaCharacterEdge]:
    edges = _available_character_edges(media)
    if not edges:
        return None
    main_edges = [edge for edge in edges if (edge.role or "").upper() == "MAIN"]
    pool = main_edges or edges
    pool = sorted(pool, key=lambda edge: edge.node.id)
    digest = hashlib.sha256(f"character:{media.id}".encode("utf-8")).hexdigest()
    index = int(digest[:8], 16) % max(1, len(pool))
    return pool[index]


def _build_character_silhouette(media: Media) -> Optional[CharacterSilhouetteGame]:
    edge = _select_character_edge(media)
    if not edge:
        return None
    image = edge.node.image
    if not image:
        return None
    image_url = image.large or image.medium
    if not image_url:
        return None

    name = (
        edge.node.name.full
        or edge.node.name.userPreferred
        or edge.node.name.native
        or "Unknown"
    )

    return CharacterSilhouetteGame(
        spec=[round_spec.model_copy(deep=True) for round_spec in CHARACTER_SILHOUETTE_ROUNDS],
        answer=_choose_answer(media),
        character=CharacterSilhouetteCharacter(
            id=edge.node.id,
            name=name,
            image=image_url,
            role=_normalize_role(edge.role),
        ),
    )


def _build_solution(media: Media) -> SolutionPayload:
    cover = media.coverImage
    cover_image = None
    if cover:
        cover_image = cover.extraLarge or cover.large or cover.medium
    synopsis: Optional[str] = None
    if media.description:
        clean = _strip_html(media.description).strip()
        if clean:
            max_length = 280
            if len(clean) > max_length:
                cutoff = clean.rfind(" ", 0, max_length)
                if cutoff <= 0:
                    cutoff = max_length
                synopsis = clean[:cutoff].rstrip() + "…"
            else:
                synopsis = clean

    streaming_links: List[SolutionStreamingLink] = []
    for link in media.externalLinks or []:
        site = link.get("site")
        url = link.get("url")
        if site and url and site in STREAMING_SITES:
            streaming_links.append(SolutionStreamingLink(site=site, url=url))

    return SolutionPayload(
        titles=media.title,
        coverImage=cover_image,
        synopsis=synopsis,
        aniListUrl=f"https://anilist.co/anime/{media.id}",
        streamingLinks=streaming_links,
    )


async def _build_guess_opening(media: Media, cache: CacheBackend) -> Optional[GuessOpeningGame]:
    cache_key = f"animethemes:clip:{media.id}"

    async def creator() -> dict:
        clip = await animethemes.find_opening_clip(_title_variants(media))
        if clip:
            return {"clip": asdict(clip)}
        return {"missing": True}

    clip_data = await cache.remember(cache_key, settings.puzzle_cache_ttl_seconds, creator)
    if clip_data.get("missing"):
        return None

    clip_model = animethemes.OpeningClip(**clip_data["clip"])

    meta = GuessOpeningMeta(
        songTitle=clip_model.song_title,
        artist=clip_model.artist,
        sequence=clip_model.sequence,
        season=f"{media.season} {media.seasonYear}" if media.seasonYear and media.season else None,
    )
    clip_payload = OpeningClip(
        audioUrl=clip_model.audio_url or clip_model.video_url,
        videoUrl=clip_model.video_url,
        mimeType="audio/mpeg" if clip_model.audio_url and clip_model.audio_url.endswith(".mp3") else None,
        lengthSeconds=clip_model.length_seconds or 90,
    )
    return GuessOpeningGame(
        spec=OPENING_ROUNDS,
        answer=_choose_answer(media),
        clip=clip_payload,
        meta=meta,
    )


async def _load_popular_pool(day: date, cache: CacheBackend, settings: Settings) -> List[Media]:
    cache_key = f"anilist:popular:{day.isoformat()}"

    async def creator() -> List[dict]:
        media = await anilist.fetch_popular_pool()
        return [m.model_dump(mode="json") for m in media]

    raw_media = await cache.remember(cache_key, settings.anilist_cache_ttl_seconds, creator)
    return [Media.model_validate(item) for item in raw_media]


async def _load_media_details(media_id: int, cache: CacheBackend, settings: Settings) -> Media:
    cache_key = f"anilist:media:{media_id}"

    async def creator() -> dict:
        details = await anilist.fetch_media_details(media_id)
        return details.model_dump(mode="json")

    raw = await cache.remember(cache_key, settings.anilist_cache_ttl_seconds, creator)
    return Media.model_validate(raw)


async def _fetch_user_lists(cache: CacheBackend, user: UserContext) -> MediaListCollection:
    cache_key = f"anilist:user-lists:{user.user_id}"

    async def creator() -> dict:
        lists = await anilist.fetch_user_media_lists(user.user_id, user.access_token)
        return lists.model_dump(mode="json")

    raw_lists = await cache.remember(cache_key, 3600, creator)
    return MediaListCollection.model_validate(raw_lists)


async def _get_recent_media(cache: CacheBackend, user_id: int) -> List[int]:
    key = USER_HISTORY_KEY_TEMPLATE.format(user_id=user_id)
    payload = await cache.get(key)
    if not payload:
        window = max(settings.puzzle_history_days, 0)
        if window <= 0:
            await cache.set(key, {"ids": []}, settings.puzzle_cache_ttl_seconds)
            return []

        session_factory = get_session_factory()
        async with session_factory() as session:
            try:
                recent_ids = await repo_list_recent_media(session, user_id, window)
                await session.commit()
            except Exception:
                await session.rollback()
                raise
        await cache.set(key, {"ids": recent_ids}, settings.puzzle_cache_ttl_seconds)
        return recent_ids
    if isinstance(payload, dict):
        return [int(mid) for mid in payload.get("ids", [])]
    if isinstance(payload, list):
        return [int(mid) for mid in payload]
    return []


async def _record_recent_media(cache: CacheBackend, user_id: int, media_id: int) -> None:
    key = USER_HISTORY_KEY_TEMPLATE.format(user_id=user_id)
    window = max(settings.puzzle_history_days, 0)

    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            recent_ids = await repo_record_recent_media(session, user_id, media_id, window)
            await session.commit()
        except Exception:
            await session.rollback()
            raise

    await cache.set(key, {"ids": recent_ids}, settings.puzzle_cache_ttl_seconds)


def _build_candidate_pool(
    popular: Sequence[Media],
    user_lists: Optional[MediaListCollection],
    recent_ids: Optional[Sequence[int]] = None,
) -> List[Media]:
    recent_set = set(recent_ids or [])
    if not user_lists:
        return [media for media in popular if media.id not in recent_set] or list(popular)
    completed_ids: set[int] = set()
    watching_ids: set[int] = set()
    for media_list in user_lists.lists:
        status = (media_list.status or media_list.name or "").upper()
        for entry in media_list.entries:
            media_id = entry.media.id
            if status in {"COMPLETED", "REPEATING"}:
                completed_ids.add(media_id)
            if status in {"CURRENT", "REPEATING", "WATCHING"}:
                watching_ids.add(media_id)
    novelty_pool = [
        media
        for media in popular
        if media.id not in completed_ids and media.id not in watching_ids and media.id not in recent_set
    ]
    if novelty_pool:
        return novelty_pool
    non_completed = [media for media in popular if media.id not in completed_ids and media.id not in recent_set]
    fallback = non_completed or [media for media in popular if media.id not in recent_set]
    return fallback or list(popular)


def _select_media(seed: str, pool: Sequence[Media]) -> Media:
    digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()
    index = int(digest[:8], 16) % max(1, len(pool))
    return pool[index]


def _choose_media_from_pool(
    base_seed: str,
    game_key: str,
    pool: Sequence[Media],
    excluded_ids: set[int],
    *,
    attempt: int = 0,
    attempted_ids: Optional[set[int]] = None,
) -> Media:
    if not pool:
        raise ValueError("Candidate pool is empty")

    filtered: List[Media] = [
        media
        for media in pool
        if media.id not in excluded_ids
        and (attempted_ids is None or media.id not in attempted_ids)
    ]
    if not filtered:
        filtered = [media for media in pool if media.id not in excluded_ids]
    if not filtered:
        filtered = list(pool)

    seed = f"{base_seed}:{game_key}:{attempt}"
    return _select_media(seed, filtered)


def _puzzle_cache_key(day: date, user: Optional[UserContext], include_guess_opening: bool) -> str:
    suffix = f"user:{user.user_id}" if user else "anon"
    opening_flag = "oped:1" if include_guess_opening else "oped:0"
    return f"{PUZZLE_CACHE_PREFIX}:{day.isoformat()}:{suffix}:{opening_flag}"


async def _assemble_daily_puzzle(
    day: date,
    *,
    user: Optional[UserContext],
    include_guess_opening: bool,
    cache: CacheBackend,
) -> DailyPuzzleResponse:
    popular_pool = await _load_popular_pool(day, cache, settings)
    user_lists: Optional[MediaListCollection] = None
    recent_ids: List[int] = []

    if user:
        user_lists = await _fetch_user_lists(cache, user)
        recent_ids = await _get_recent_media(cache, user.user_id)

    pool = _build_candidate_pool(popular_pool, user_lists, recent_ids)
    base_seed = day.isoformat()
    if user:
        base_seed = f"{base_seed}:{user.user_id}"

    selected_ids: set[int] = set()
    recorded_ids: List[int] = []

    anidle_candidate = _choose_media_from_pool(base_seed, "anidle", pool, selected_ids)
    anidle_media = await _load_media_details(anidle_candidate.id, cache, settings)
    selected_ids.add(anidle_media.id)
    if anidle_media.id not in recorded_ids:
        recorded_ids.append(anidle_media.id)
    anidle_bundle = AnidlePuzzleBundle(
        mediaId=anidle_media.id,
        puzzle=_build_anidle(anidle_media),
        solution=_build_solution(anidle_media),
    )

    poster_candidate = _choose_media_from_pool(
        base_seed, "poster_zoomed", pool, selected_ids
    )
    poster_media = await _load_media_details(poster_candidate.id, cache, settings)
    selected_ids.add(poster_media.id)
    if poster_media.id not in recorded_ids:
        recorded_ids.append(poster_media.id)
    poster_bundle = PosterZoomPuzzleBundle(
        mediaId=poster_media.id,
        puzzle=_build_poster(poster_media),
        solution=_build_solution(poster_media),
    )

    synopsis_candidate = _choose_media_from_pool(
        base_seed, "redacted_synopsis", pool, selected_ids
    )
    synopsis_media = await _load_media_details(synopsis_candidate.id, cache, settings)
    selected_ids.add(synopsis_media.id)
    if synopsis_media.id not in recorded_ids:
        recorded_ids.append(synopsis_media.id)
    synopsis_bundle = RedactedSynopsisPuzzleBundle(
        mediaId=synopsis_media.id,
        puzzle=_build_synopsis(synopsis_media),
        solution=_build_solution(synopsis_media),
    )

    character_bundle: Optional[CharacterSilhouettePuzzleBundle] = None
    attempted_character_ids: set[int] = set()
    max_character_attempts = max(len(pool), 1)
    for attempt in range(max_character_attempts):
        candidate = _choose_media_from_pool(
            base_seed,
            "character_silhouette",
            pool,
            selected_ids,
            attempt=attempt,
            attempted_ids=attempted_character_ids,
        )
        character_media = await _load_media_details(candidate.id, cache, settings)
        attempted_character_ids.add(character_media.id)
        game = _build_character_silhouette(character_media)
        if not game:
            continue
        selected_ids.add(character_media.id)
        if character_media.id not in recorded_ids:
            recorded_ids.append(character_media.id)
        character_bundle = CharacterSilhouettePuzzleBundle(
            mediaId=character_media.id,
            puzzle=game,
            solution=_build_solution(character_media),
        )
        break

    if not character_bundle:
        for fallback_media in (anidle_media, poster_media, synopsis_media):
            game = _build_character_silhouette(fallback_media)
            if not game:
                continue
            selected_ids.add(fallback_media.id)
            if fallback_media.id not in recorded_ids:
                recorded_ids.append(fallback_media.id)
            character_bundle = CharacterSilhouettePuzzleBundle(
                mediaId=fallback_media.id,
                puzzle=game,
                solution=_build_solution(fallback_media),
            )
            break

    if not character_bundle:
        raise ValueError("Unable to build character silhouette puzzle")

    guess_bundle: Optional[GuessOpeningPuzzleBundle] = None
    if include_guess_opening:
        attempted_ids: set[int] = set()
        max_attempts = max(len(pool), 1)
        for attempt in range(max_attempts):
            candidate = _choose_media_from_pool(
                base_seed,
                "guess_the_opening",
                pool,
                selected_ids,
                attempt=attempt,
                attempted_ids=attempted_ids,
            )
            opening_media = await _load_media_details(candidate.id, cache, settings)
            attempted_ids.add(opening_media.id)
            opening_game = await _build_guess_opening(opening_media, cache)
            if not opening_game:
                continue
            selected_ids.add(opening_media.id)
            if opening_media.id not in recorded_ids:
                recorded_ids.append(opening_media.id)
            guess_bundle = GuessOpeningPuzzleBundle(
                mediaId=opening_media.id,
                puzzle=opening_game,
                solution=_build_solution(opening_media),
            )
            break

    difficulty_hint: Optional[int] = None
    if user:
        preferences = await load_user_preferences(user.user_id)
        difficulty_hint = preferences.difficulty_level

    games = GamesPayload(
        anidle=anidle_bundle,
        poster_zoomed=poster_bundle,
        redacted_synopsis=synopsis_bundle,
        character_silhouette=character_bundle,
        guess_the_opening=guess_bundle,
        difficulty_level=difficulty_hint,
    )

    if user:
        for media_id in recorded_ids:
            await _record_recent_media(cache, user.user_id, media_id)

    guess_opening_enabled = bool(guess_bundle)

    return DailyPuzzleResponse(
        date=day,
        games=games,
        guess_the_opening_enabled=guess_opening_enabled,
    )


async def get_daily_puzzle(
    day: date,
    *,
    user: Optional[UserContext] = None,
    include_guess_opening: bool = False,
) -> DailyPuzzleResponse:
    cache = await _get_cache()
    cache_key = _puzzle_cache_key(day, user, include_guess_opening)

    async def creator() -> dict:
        puzzle = await _assemble_daily_puzzle(
            day,
            user=user,
            include_guess_opening=include_guess_opening,
            cache=cache,
        )
        return puzzle.model_dump(mode="json")

    payload = await cache.remember(cache_key, settings.puzzle_cache_ttl_seconds, creator)
    return DailyPuzzleResponse.model_validate(payload)
