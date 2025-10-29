from __future__ import annotations

import logging
from typing import Dict, Iterable, List, Literal, Optional, Tuple

from fastapi import HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from ..core.config import settings
from ..puzzles import engine as puzzle_engine
from ..puzzles.engine import Media, UserContext
from ..services import title_index
from ..services.anilist import MediaTitlePair, search_media
from ..services.cache import CacheBackend

logger = logging.getLogger(__name__)


class AnidleScalarFeedback(BaseModel):
    guess: Optional[int] = None
    target: Optional[int] = None
    status: Literal["match", "higher", "lower", "unknown"]
    guess_season: Optional[str] = None
    target_season: Optional[str] = None


class AnidleListFeedbackItem(BaseModel):
    value: str
    status: Literal["match", "miss"]


class AnidleGuessEvaluationPayload(BaseModel):
    puzzle_media_id: int
    guess: str
    guess_media_id: Optional[int] = None


class AnidleGuessEvaluationResponse(BaseModel):
    title: str
    correct: bool
    year: AnidleScalarFeedback
    average_score: AnidleScalarFeedback
    popularity: AnidleScalarFeedback
    genres: List[AnidleListFeedbackItem]
    tags: List[AnidleListFeedbackItem]
    studios: List[AnidleListFeedbackItem]
    source: List[AnidleListFeedbackItem]


def _normalize_text(value: str) -> str:
    return " ".join(value.split()).casefold()


def _dedupe_preserve_order(values: Iterable[str]) -> List[str]:
    seen: set[str] = set()
    result: List[str] = []
    for value in values:
        if not value:
            continue
        normalized = value.strip()
        if not normalized:
            continue
        lowered = normalized.casefold()
        if lowered in seen:
            continue
        seen.add(lowered)
        result.append(normalized)
    return result


def _format_enum_label(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    normalized = value.replace("_", " ").replace("-", " ").strip()
    if not normalized:
        return None
    return normalized.title()


def _extract_studio_names(media: Media) -> List[str]:
    studios = getattr(media, "studios", None)
    if not studios or not getattr(studios, "edges", None):
        return []
    primary: List[str] = []
    secondary: List[str] = []
    for edge in studios.edges:
        if not edge:
            continue
        node = getattr(edge, "node", None)
        if not node:
            continue
        name = getattr(node, "name", None)
        if not name:
            continue
        bucket = primary if getattr(edge, "isMain", False) else secondary
        bucket.append(name)
    return _dedupe_preserve_order(list(primary) + list(secondary))


def _build_scalar_feedback(
    guess_value: Optional[int],
    target_value: Optional[int],
    *,
    guess_season: Optional[str] = None,
    target_season: Optional[str] = None,
) -> AnidleScalarFeedback:
    if guess_value is None or target_value is None:
        status: Literal["match", "higher", "lower", "unknown"] = "unknown"
    elif guess_value == target_value:
        status = "match"
    elif guess_value > target_value:
        status = "higher"
    else:
        status = "lower"
    return AnidleScalarFeedback(
        guess=guess_value,
        target=target_value,
        status=status,
        guess_season=guess_season,
        target_season=target_season,
    )


def _build_list_feedback(
    guess_values: Iterable[str],
    target_values: Iterable[str],
) -> List[AnidleListFeedbackItem]:
    normalized_targets = {value.casefold() for value in target_values if value}
    feedback: List[AnidleListFeedbackItem] = []
    for value in _dedupe_preserve_order(guess_values):
        status: Literal["match", "miss"] = (
            "match" if value.casefold() in normalized_targets else "miss"
        )
        feedback.append(AnidleListFeedbackItem(value=value, status=status))
    return feedback


class AnidleEvaluationService:
    """Evaluate Anidle guesses while caching expensive lookups per request."""

    def __init__(
        self,
        *,
        cache: CacheBackend,
        session_factory: async_sessionmaker[AsyncSession],
        user: Optional[UserContext],
    ) -> None:
        self._cache = cache
        self._session_factory = session_factory
        self._user = user
        self._media_cache: Dict[int, Media] = {}
        self._title_search_cache: Dict[Tuple[str, int], List[title_index.TitleMatch]] = {}
        self._remote_search_cache: Dict[Tuple[str, int], List[MediaTitlePair]] = {}
        self._metrics: Dict[str, int] = {
            "media_load_calls": 0,
            "title_search_calls": 0,
            "remote_search_calls": 0,
        }

    @property
    def metrics(self) -> Dict[str, int]:
        return dict(self._metrics)

    async def evaluate_guess(
        self, payload: AnidleGuessEvaluationPayload
    ) -> AnidleGuessEvaluationResponse:
        guess_value = payload.guess.strip()
        if not guess_value:
            raise HTTPException(status_code=400, detail="Guess cannot be empty")

        try:
            target_media = await self._load_media(payload.puzzle_media_id)
        except Exception as exc:  # pragma: no cover - defensive upstream guard
            logger.info("Failed to load target media %s: %s", payload.puzzle_media_id, exc)
            raise HTTPException(status_code=404, detail="Puzzle media not found") from exc

        guess_media: Optional[Media] = None
        if payload.guess_media_id is not None:
            guess_media = await self._load_media_optional(payload.guess_media_id)

        normalized_guess = _normalize_text(guess_value)

        index_matches: List[title_index.TitleMatch] = []
        if guess_media is None:
            index_matches = await self._search_title_matches(guess_value, limit=5)
            best_candidate: Optional[Media] = None
            for match in index_matches:
                candidate = await self._load_media_optional(match.media_id)
                if not candidate:
                    continue
                if best_candidate is None:
                    best_candidate = candidate
                variants = puzzle_engine._title_variants(candidate)
                if any(
                    variant and _normalize_text(variant) == normalized_guess
                    for variant in variants
                ):
                    guess_media = candidate
                    break
            if guess_media is None and best_candidate is not None:
                guess_media = best_candidate

        if guess_media is None and not index_matches:
            search_results = await self._search_remote_titles(guess_value, limit=5)
            best_candidate: Optional[Media] = None
            for pair in search_results:
                candidate = await self._load_media_optional(pair.id)
                if not candidate:
                    continue
                if best_candidate is None:
                    best_candidate = candidate
                variants = puzzle_engine._title_variants(candidate)
                if any(
                    variant and _normalize_text(variant) == normalized_guess
                    for variant in variants
                ):
                    guess_media = candidate
                    break
            if guess_media is None and best_candidate is not None:
                guess_media = best_candidate

        target_year = target_media.seasonYear or (target_media.startDate or {}).get("year")
        target_season = _format_enum_label(target_media.season)
        target_score = target_media.averageScore
        target_popularity = target_media.popularity
        target_genres = [genre for genre in target_media.genres if genre]
        target_tags = puzzle_engine._extract_top_tags(target_media)
        target_studios = _extract_studio_names(target_media)
        target_source = _format_enum_label(getattr(target_media, "source", None))

        if guess_media is not None:
            resolved_title = (
                guess_media.title.userPreferred
                or guess_media.title.english
                or guess_media.title.romaji
                or guess_media.title.native
                or guess_value
            )
            guess_year = guess_media.seasonYear or (guess_media.startDate or {}).get("year")
            guess_season = _format_enum_label(guess_media.season)
            guess_score = guess_media.averageScore
            guess_popularity = guess_media.popularity
            guess_genres = [genre for genre in guess_media.genres if genre]
            guess_tags = puzzle_engine._extract_top_tags(guess_media)
            guess_studios = _extract_studio_names(guess_media)
            guess_source = _format_enum_label(getattr(guess_media, "source", None))
            correct = guess_media.id == target_media.id
        else:
            resolved_title = guess_value
            guess_year = None
            guess_season = None
            guess_score = None
            guess_popularity = None
            guess_genres: List[str] = []
            guess_tags: List[str] = []
            guess_studios: List[str] = []
            guess_source: Optional[str] = None
            correct = any(
                variant and _normalize_text(variant) == normalized_guess
                for variant in puzzle_engine._title_variants(target_media)
            )

        return AnidleGuessEvaluationResponse(
            title=resolved_title,
            correct=correct,
            year=_build_scalar_feedback(
                guess_year,
                target_year,
                guess_season=guess_season,
                target_season=target_season,
            ),
            average_score=_build_scalar_feedback(guess_score, target_score),
            popularity=_build_scalar_feedback(guess_popularity, target_popularity),
            genres=_build_list_feedback(guess_genres, target_genres),
            tags=_build_list_feedback(guess_tags, target_tags),
            studios=_build_list_feedback(guess_studios, target_studios),
            source=_build_list_feedback(
                [guess_source] if guess_source else [],
                [target_source] if target_source else [],
            ),
        )

    async def _load_media(self, media_id: int) -> Media:
        if media_id in self._media_cache:
            return self._media_cache[media_id]
        self._metrics["media_load_calls"] += 1
        media = await puzzle_engine._load_media_details(media_id, self._cache, settings)
        self._media_cache[media_id] = media
        return media

    async def _load_media_optional(self, media_id: int) -> Optional[Media]:
        if media_id in self._media_cache:
            return self._media_cache[media_id]
        try:
            return await self._load_media(media_id)
        except Exception:
            logger.debug("Failed to load media %s", media_id)
            return None

    async def _search_title_matches(
        self, query: str, *, limit: int
    ) -> List[title_index.TitleMatch]:
        key = (query.casefold(), limit)
        cached = self._title_search_cache.get(key)
        if cached is not None:
            return cached
        self._metrics["title_search_calls"] += 1
        async with self._session_factory() as session:
            matches = await title_index.search_titles(session, query, limit=limit)
        self._title_search_cache[key] = matches
        return matches

    async def _search_remote_titles(
        self, query: str, *, limit: int
    ) -> List[MediaTitlePair]:
        key = (query.casefold(), limit)
        cached = self._remote_search_cache.get(key)
        if cached is not None:
            return cached
        self._metrics["remote_search_calls"] += 1
        token = self._user.access_token if self._user else None
        results = await search_media(query, limit=limit, token=token)
        self._remote_search_cache[key] = results
        return results
