from __future__ import annotations

import hashlib
import html
import re
from dataclasses import asdict, dataclass
from datetime import date
from typing import List, Optional, Sequence

from ..core.config import Settings, settings
from ..services import animethemes, anilist
from ..services.anilist import Media, MediaListCollection
from ..services.cache import CacheBackend, get_cache
from .models import (
    AnidleGame,
    AnidleHints,
    DailyPuzzleResponse,
    GamesPayload,
    GuessOpeningGame,
    GuessOpeningMeta,
    OpeningClip,
    PosterZoomGame,
    PosterZoomMeta,
    RedactedSynopsisGame,
    RoundSpec,
    SolutionPayload,
    SolutionStreamingLink,
)

ANIDLE_ROUNDS = [
    RoundSpec(difficulty=1, hints=["genres", "year"]),
    RoundSpec(difficulty=2, hints=["episodes", "popularity", "average_score"]),
    RoundSpec(difficulty=3, hints=["duration"]),
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
    RoundSpec(difficulty=3, hints=["song"]),
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


def _build_anidle(media: Media) -> AnidleGame:
    hints = AnidleHints(
        genres=[g for g in media.genres if g],
        year=media.seasonYear or (media.startDate or {}).get("year"),
        episodes=media.episodes,
        duration=media.duration,
        popularity=media.popularity,
        average_score=media.averageScore,
    )
    return AnidleGame(spec=ANIDLE_ROUNDS, answer=_choose_answer(media), hints=hints)


def _build_poster(media: Media) -> PosterZoomGame:
    cover = media.coverImage or {}
    image = cover.extraLarge or cover.large or cover.medium
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
        return []
    if isinstance(payload, dict):
        return [int(mid) for mid in payload.get("ids", [])]
    if isinstance(payload, list):
        return [int(mid) for mid in payload]
    return []


async def _record_recent_media(cache: CacheBackend, user_id: int, media_id: int) -> None:
    key = USER_HISTORY_KEY_TEMPLATE.format(user_id=user_id)
    recent = await _get_recent_media(cache, user_id)
    recent = [mid for mid in recent if mid != media_id]
    recent.insert(0, media_id)
    window = settings.puzzle_history_days
    await cache.set(key, {"ids": recent[:window]}, settings.puzzle_cache_ttl_seconds)


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
    seed = day.isoformat()
    if user:
        seed = f"{seed}:{user.user_id}"
    chosen = _select_media(seed, pool)
    media = await _load_media_details(chosen.id, cache, settings)

    games = GamesPayload(
        anidle=_build_anidle(media),
        poster_zoomed=_build_poster(media),
        redacted_synopsis=_build_synopsis(media),
        guess_the_opening=None,
    )

    if include_guess_opening:
        opening_game = await _build_guess_opening(media, cache)
        games.guess_the_opening = opening_game

    if user:
        await _record_recent_media(cache, user.user_id, media.id)

    return DailyPuzzleResponse(
        date=day,
        mediaId=media.id,
        games=games,
        solution=_build_solution(media),
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
