from __future__ import annotations

import base64
import binascii
import hashlib
import html
import io
import logging
import math
import random
import re
from dataclasses import asdict, dataclass
from datetime import date
from typing import Any, List, Optional, Sequence, Tuple

import httpx
import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, UnidentifiedImageError

from ..core.config import Settings, settings
from ..core.database import get_session_factory
from ..services import animethemes, anilist, title_index
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
    GuessOpeningRound,
    OpeningClip,
    PosterCropStage,
    PosterZoomGame,
    PosterZoomMeta,
    PosterZoomPuzzleBundle,
    RedactedSynopsisGame,
    RedactedSynopsisSegment,
    RedactedSynopsisPuzzleBundle,
    RoundSpec,
    SolutionPayload,
    SolutionStreamingLink,
    SynopsisHint,
)

ANIDLE_SYNOPSIS_REVEAL_LEVELS: Sequence[float] = (0.3, 0.5, 0.7)

ANIDLE_ROUNDS = [
    RoundSpec(difficulty=1, hints=["synopsis:0"]),
    RoundSpec(difficulty=2, hints=["synopsis:1"]),
    RoundSpec(difficulty=3, hints=["synopsis:2"]),
]

POSTER_ROUNDS = [
    RoundSpec(difficulty=1, hints=[]),
    RoundSpec(difficulty=2, hints=["genres"]),
    RoundSpec(difficulty=3, hints=["year", "format"]),
]

MAX_POSTER_HINTS = max(0, len(POSTER_ROUNDS) - 1)

if hasattr(Image, "Resampling"):
    POSTER_RESAMPLE = Image.Resampling.LANCZOS  # type: ignore[attr-defined]
else:  # pragma: no cover - fallback for older Pillow
    POSTER_RESAMPLE = Image.LANCZOS  # type: ignore[attr-defined]

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

logger = logging.getLogger(__name__)


def _generate_character_silhouette(image_url: str) -> Optional[str]:
    try:
        response = httpx.get(image_url, timeout=10.0)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        logger.warning("Failed to download character artwork for silhouette", exc_info=exc)
        return None

    image_data = np.frombuffer(response.content, dtype=np.uint8)
    if image_data.size == 0:
        logger.warning("Character artwork response was empty when building silhouette")
        return None

    image = cv2.imdecode(image_data, cv2.IMREAD_COLOR)
    if image is None:
        logger.warning("Unable to decode character artwork for silhouette generation")
        return None

    try:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)

        _, otsu_mask = cv2.threshold(
            blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU
        )
        otsu_mask = cv2.bitwise_not(otsu_mask)

        edges = cv2.Canny(blurred, 50, 140)
        edge_kernel = np.ones((5, 5), np.uint8)
        expanded_edges = cv2.dilate(edges, edge_kernel, iterations=1)

        combined = cv2.bitwise_or(otsu_mask, expanded_edges)
        smooth_kernel = np.ones((7, 7), np.uint8)
        combined = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, smooth_kernel, iterations=2)

        contours, _ = cv2.findContours(
            combined, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )

        mask = np.zeros(gray.shape, dtype=np.uint8)
        if contours:
            contours = sorted(contours, key=cv2.contourArea, reverse=True)
            primary_area = cv2.contourArea(contours[0])
            if primary_area > 0:
                cv2.drawContours(mask, [contours[0]], -1, 255, thickness=-1)
                for contour in contours[1:]:
                    if cv2.contourArea(contour) >= primary_area * 0.15:
                        cv2.drawContours(mask, [contour], -1, 255, thickness=-1)
        else:
            mask = combined

        mask = cv2.GaussianBlur(mask, (9, 9), 0)
        mask = cv2.normalize(mask, None, 0, 255, cv2.NORM_MINMAX)

        silhouette = cv2.bitwise_and(image, image, mask=mask)
        background = np.zeros_like(image)
        silhouette = cv2.addWeighted(silhouette, 1.0, background, 0.0, 0.0)

        success, buffer = cv2.imencode(".png", silhouette)
        if not success:
            logger.warning("Failed to encode character silhouette image")
            return None

        base64_image = base64.b64encode(buffer.tobytes()).decode("ascii")
        return f"data:image/png;base64,{base64_image}"
    except Exception as exc:  # noqa: BLE001
        logger.warning("Error while generating character silhouette", exc_info=exc)
        return None


TOKEN_PATTERN = re.compile(r"\s+|[^\w\s]+|\w+(?:'\w+)?", re.UNICODE)
WORD_PATTERN = re.compile(r"\w+(?:'\w+)?", re.UNICODE)

@dataclass
class UserContext:
    user_id: int
    username: Optional[str]
    access_token: str


class PosterImageError(Exception):
    """Raised when poster image generation fails."""

    def __init__(self, message: str, *, status_code: int = 500) -> None:
        super().__init__(message)
        self.status_code = status_code


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


def _generate_synopsis_levels(
    segments: Sequence[RedactedSynopsisSegment],
    masked_word_indices: Sequence[int],
    reveal_levels: Sequence[float],
) -> List[SynopsisHint]:
    if not segments:
        return []

    total_masked = len(masked_word_indices)
    base_text = "".join(segment.text for segment in segments).strip()

    if total_masked <= 0:
        return [SynopsisHint(ratio=max(0.0, min(level, 1.0)), text=base_text) for level in reveal_levels]

    hints: List[SynopsisHint] = []
    for level in reveal_levels:
        ratio = max(0.0, min(level, 1.0))
        if ratio <= 0.0:
            reveal_count = 0
        elif ratio >= 1.0:
            reveal_count = total_masked
        else:
            reveal_count = max(1, int(round(total_masked * ratio)))

        revealed = set(masked_word_indices[: min(reveal_count, total_masked)])

        pieces: List[str] = []
        for index, segment in enumerate(segments):
            if segment.masked and index not in revealed:
                pieces.append("[REDACTED]")
            else:
                pieces.append(segment.text)

        redacted_text = "".join(pieces).strip()
        hints.append(SynopsisHint(ratio=ratio, text=redacted_text))

    return hints


def _build_anidle_synopsis(media: Media) -> List[SynopsisHint]:
    _, segments, masked_indices, _ = _redact_description(media)
    return _generate_synopsis_levels(segments, masked_indices, ANIDLE_SYNOPSIS_REVEAL_LEVELS)


def _build_anidle(media: Media) -> AnidleGame:
    hints = AnidleHints(
        genres=[g for g in media.genres if g],
        tags=_extract_top_tags(media),
        year=media.seasonYear or (media.startDate or {}).get("year"),
        episodes=media.episodes,
        duration=media.duration,
        popularity=media.popularity,
        average_score=media.averageScore,
        synopsis=_build_anidle_synopsis(media),
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


def _tokenize_synopsis(text: str) -> tuple[List[str], List[int]]:
    tokens: List[str] = []
    word_indices: List[int] = []
    for match in TOKEN_PATTERN.finditer(text):
        token = match.group(0)
        tokens.append(token)
        if WORD_PATTERN.fullmatch(token):
            word_indices.append(len(tokens) - 1)
    return tokens, word_indices


def _mask_title_variants(tokens: List[str], word_indices: List[int], variants: Sequence[str]) -> set[int]:
    masked: set[int] = set()
    if not variants or not word_indices:
        return masked

    word_sequence = [tokens[index].casefold() for index in word_indices]

    for variant in sorted(set(variants), key=len, reverse=True):
        variant_words = [word.casefold() for word in WORD_PATTERN.findall(variant)]
        if not variant_words:
            continue
        start = 0
        max_start = len(word_sequence) - len(variant_words)
        while start <= max_start:
            if word_sequence[start : start + len(variant_words)] == variant_words:
                for offset in range(len(variant_words)):
                    masked.add(word_indices[start + offset])
                start += len(variant_words)
            else:
                start += 1
    return masked

def _deserialize_cached_image(payload: Any) -> Optional[Tuple[bytes, str]]:
    if not isinstance(payload, dict):
        return None
    encoded = payload.get("data")
    if not isinstance(encoded, str):
        return None
    try:
        decoded = base64.b64decode(encoded)
    except (binascii.Error, ValueError):
        return None
    mime = payload.get("mime") or "image/jpeg"
    return decoded, mime


def _normalize_hint_count(value: Any) -> int:
    try:
        hints_value = int(value)
    except (TypeError, ValueError):
        return 0
    if hints_value < 0:
        return 0
    return hints_value


def _resolve_poster_hint_round(hints_used: int, total_rounds: int) -> int:
    if total_rounds <= 0:
        return 1
    return max(1, min(total_rounds, hints_used + 1))


def _compute_clarity_level(hint_round: int, total_rounds: int) -> float:
    if total_rounds <= 1:
        return 1.0
    progress = (hint_round - 1) / max(1, total_rounds - 1)
    min_clarity = 0.2
    normalized = min_clarity + (1 - min_clarity) * progress
    return max(0.0, min(1.0, round(normalized, 2)))


def _apply_crop_stage(poster: Image.Image, stage: PosterCropStage) -> Image.Image:
    width, height = poster.size
    if width <= 0 or height <= 0:
        return poster

    scale = stage.scale if stage.scale and stage.scale > 0 else 1.0
    crop_width = width / scale
    crop_height = height / scale

    if crop_width <= 0 or crop_height <= 0:
        return poster

    center_x = (stage.offset_x / 100.0) * width
    center_y = (stage.offset_y / 100.0) * height

    max_left = max(0.0, width - crop_width)
    max_top = max(0.0, height - crop_height)
    left = min(max_left, max(0.0, center_x - (crop_width / 2)))
    top = min(max_top, max(0.0, center_y - (crop_height / 2)))
    right = left + crop_width
    bottom = top + crop_height

    cropped = poster.crop((left, top, right, bottom))
    if cropped.size == poster.size:
        return cropped

    return cropped.resize(poster.size, resample=POSTER_RESAMPLE)


async def _load_poster_source(
    media: Media, cache: CacheBackend, settings: Settings
) -> Tuple[bytes, str]:
    cache_key = f"poster-image-source:{media.id}"
    cached = await cache.get(cache_key)
    cached_image = _deserialize_cached_image(cached)
    if cached_image:
        return cached_image

    cover = media.coverImage or CoverImage()
    image_url = getattr(cover, "extraLarge", None) or getattr(cover, "large", None)
    if not image_url:
        image_url = getattr(cover, "medium", None)
    if not image_url:
        raise PosterImageError("Poster image unavailable", status_code=404)

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(image_url)
            response.raise_for_status()
    except httpx.HTTPError as exc:
        logger.warning("Failed to fetch poster image for %s: %s", media.id, exc)
        raise PosterImageError("Unable to fetch poster image", status_code=502) from exc

    content = response.content
    mime = response.headers.get("content-type") or "image/jpeg"

    try:
        encoded = base64.b64encode(content).decode("ascii")
        await cache.set(
            cache_key,
            {"data": encoded, "mime": mime},
            settings.puzzle_cache_ttl_seconds,
        )
    except Exception as exc:  # pragma: no cover - cache failures shouldn't block gameplay
        logger.debug("Unable to cache poster source image: %s", exc)

    return content, mime


def _render_poster_variant(
    source: bytes,
    hint_round: int,
    total_rounds: int,
    crop_stage: Optional[PosterCropStage],
) -> Tuple[bytes, str]:
    clarity = _compute_clarity_level(hint_round, total_rounds)

    try:
        with Image.open(io.BytesIO(source)) as poster:
            poster = poster.convert("RGB")
            if crop_stage is not None:
                poster = _apply_crop_stage(poster, crop_stage)
            blur_radius = (1.0 - clarity) * 12.0
            if blur_radius > 0:
                poster = poster.filter(ImageFilter.GaussianBlur(radius=blur_radius))
            sharpness_factor = 0.4 + (clarity * 0.6)
            poster = ImageEnhance.Sharpness(poster).enhance(sharpness_factor)
            output = io.BytesIO()
            poster.save(output, format="JPEG", quality=90, optimize=True)
    except UnidentifiedImageError as exc:
        raise PosterImageError("Unable to process poster image", status_code=500) from exc

    return output.getvalue(), "image/jpeg"


async def generate_poster_image(media_id: int, hints: int) -> Tuple[bytes, str]:
    cache = await _get_cache()
    requested_hints = _normalize_hint_count(hints)
    bucket = min(requested_hints, MAX_POSTER_HINTS)
    cache_key = f"poster-image:{media_id}:{bucket}"

    cached = await cache.get(cache_key)
    cached_image = _deserialize_cached_image(cached)
    if cached_image:
        return cached_image

    media = await _load_media_details(media_id, cache, settings)
    crop_stages = _build_poster_crop_stages(media)
    total_rounds = max(1, max(len(crop_stages), len(POSTER_ROUNDS)))
    max_hint_count = max(0, total_rounds - 1)
    effective_hints = min(bucket, max_hint_count)
    final_cache_key = f"poster-image:{media_id}:{effective_hints}"

    if final_cache_key != cache_key:
        cached = await cache.get(final_cache_key)
        cached_image = _deserialize_cached_image(cached)
        if cached_image:
            return cached_image

    hint_round = _resolve_poster_hint_round(effective_hints, total_rounds)
    crop_stage: Optional[PosterCropStage] = None
    if crop_stages:
        crop_index = min(len(crop_stages) - 1, hint_round - 1)
        crop_stage = crop_stages[crop_index]

    source, _ = await _load_poster_source(media, cache, settings)
    variant_bytes, mime = _render_poster_variant(
        source,
        hint_round,
        total_rounds,
        crop_stage,
    )

    try:
        encoded = base64.b64encode(variant_bytes).decode("ascii")
        await cache.set(
            final_cache_key,
            {"data": encoded, "mime": mime},
            settings.puzzle_cache_ttl_seconds,
        )
    except Exception as exc:  # pragma: no cover - cache failures shouldn't block gameplay
        logger.debug("Unable to cache poster variant: %s", exc)

    return variant_bytes, mime


def _redact_description(
    media: Media,
) -> tuple[str, List[RedactedSynopsisSegment], List[int], List[str]]:
    if not media.description:
        return "", [], [], []

    clean_text = _strip_html(media.description)
    tokens, word_indices = _tokenize_synopsis(clean_text)
    if not tokens:
        return "", [], [], []

    variants = _title_variants(media)
    title_masked_indices = _mask_title_variants(tokens, word_indices, variants)

    word_count = len(word_indices)
    masked_indices: set[int] = set(title_masked_indices)
    if word_count == 1:
        masked_target = 1
    else:
        desired = math.ceil(word_count * 0.7)
        desired = max(desired, len(masked_indices))
        if word_count > 1:
            desired = min(desired, word_count - 1) if len(masked_indices) < word_count else word_count
        masked_target = max(1, min(desired, word_count))

    if len(masked_indices) < masked_target:
        remaining_indices = [index for index in word_indices if index not in masked_indices]
        if remaining_indices:
            seed_source = hashlib.sha256(f"synopsis:{media.id}".encode("utf-8")).hexdigest()
            seed = int(seed_source[:16], 16)
            rng = random.Random(seed)
            rng.shuffle(remaining_indices)
            needed = masked_target - len(masked_indices)
            for index in remaining_indices[:needed]:
                masked_indices.add(index)

    additional_indices = sorted(index for index in masked_indices if index not in title_masked_indices)
    title_indices_sorted = sorted(title_masked_indices)
    masked_word_indices = additional_indices + [index for index in title_indices_sorted if index not in additional_indices]

    segments = [
        RedactedSynopsisSegment(text=token, masked=index in masked_indices)
        for index, token in enumerate(tokens)
    ]
    masked_words = [segments[index].text for index in masked_word_indices]

    return clean_text.strip(), segments, masked_word_indices, masked_words


def _build_synopsis(media: Media) -> RedactedSynopsisGame:
    text, segments, masked_indices, masked_words = _redact_description(media)
    return RedactedSynopsisGame(
        spec=SYNOPSIS_ROUNDS,
        answer=_choose_answer(media),
        text=text,
        segments=segments,
        masked_word_indices=masked_indices,
        masked_words=masked_words,
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

    silhouette_image = _generate_character_silhouette(image_url)

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
            image=silhouette_image or image_url,
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


async def _build_guess_opening_round(
    media: Media,
    cache: CacheBackend,
    *,
    order: Optional[int] = None,
    total_rounds: Optional[int] = None,
) -> Optional[GuessOpeningRound]:
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
        roundOrder=order,
        roundTotal=total_rounds,
    )
    clip_payload = OpeningClip(
        audioUrl=clip_model.audio_url or clip_model.video_url,
        videoUrl=clip_model.video_url,
        mimeType="audio/mpeg" if clip_model.audio_url and clip_model.audio_url.endswith(".mp3") else None,
        lengthSeconds=clip_model.length_seconds or 90,
    )
    return GuessOpeningRound(
        order=order or 1,
        mediaId=media.id,
        spec=[round_spec.model_copy(deep=True) for round_spec in OPENING_ROUNDS],
        answer=_choose_answer(media),
        clip=clip_payload,
        meta=meta,
        solution=_build_solution(media),
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
    media = Media.model_validate(raw)

    variants = _title_variants(media)
    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            await title_index.ingest_media(session, media, variants)
            await session.commit()
        except Exception:  # pragma: no cover - index warming must not break gameplay
            await session.rollback()
            logger.exception("Failed to warm title index for media %s", media.id)

    return media


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
    if not filtered and attempted_ids:
        filtered = [media for media in pool if media.id not in attempted_ids]
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
    opening_rounds: List[GuessOpeningRound] = []
    opening_pool: Optional[List[Media]] = None
    if include_guess_opening and settings.guess_opening_pool_enabled:
        try:
            opening_pool = await anilist.fetch_opening_pool(
                cache,
                day=day,
                ttl=settings.anilist_cache_ttl_seconds,
            )
        except Exception:
            logger.exception("Failed to load dedicated opening pool")
    if include_guess_opening:
        candidate_pool = opening_pool or pool
        if candidate_pool:
            required_rounds = 3
            attempted_ids: set[int] = set()
            selected_for_opening: set[int] = set()
            max_attempts = max(len(candidate_pool) * required_rounds, required_rounds * 3)
            attempt_counter = 0
            while len(opening_rounds) < required_rounds and attempt_counter < max_attempts:
                candidate = _choose_media_from_pool(
                    base_seed,
                    f"guess_the_opening:{len(opening_rounds)}",
                    candidate_pool,
                    selected_ids.union(selected_for_opening),
                    attempt=attempt_counter,
                    attempted_ids=attempted_ids,
                )
                attempt_counter += 1
                opening_media = await _load_media_details(candidate.id, cache, settings)
                attempted_ids.add(opening_media.id)
                opening_round = await _build_guess_opening_round(
                    opening_media,
                    cache,
                    order=len(opening_rounds) + 1,
                    total_rounds=required_rounds,
                )
                if not opening_round:
                    continue
                opening_rounds.append(opening_round)
                selected_for_opening.add(opening_round.mediaId)
            if len(opening_rounds) == required_rounds:
                selected_ids.update(selected_for_opening)
                for round_payload in opening_rounds:
                    if round_payload.mediaId not in recorded_ids:
                        recorded_ids.append(round_payload.mediaId)
                guess_bundle = GuessOpeningPuzzleBundle(
                    mediaId=opening_rounds[0].mediaId,
                    puzzle=GuessOpeningGame(rounds=list(opening_rounds)),
                    solution=opening_rounds[0].solution,
                )

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

    guess_opening_enabled = bool(
        guess_bundle
        and guess_bundle.puzzle.rounds
        and len(guess_bundle.puzzle.rounds) >= 3
    )

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
