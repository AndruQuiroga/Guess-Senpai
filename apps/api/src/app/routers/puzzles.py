from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from time import perf_counter
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, Request, Response
from pydantic import BaseModel

from ..core.config import settings
from ..core.database import get_session_factory
from ..puzzles import engine as puzzle_engine
from ..puzzles.engine import UserContext, _choose_answer, _title_variants, get_daily_puzzle
from ..puzzles.models import (
    DailyProgressPayload,
    DailyPuzzleResponse,
    PuzzleStatsPayload,
    RecentMediaSummary,
    StreakPayload,
)
from ..services import character_index, title_index
from ..services.cache import get_cache
from ..services.progress import (
    load_daily_progress,
    load_progress_aggregate,
    load_progress_history,
    load_streak,
    merge_daily_progress,
    store_streak,
)
from ..services.session import SessionData, get_session_manager
from ..services.anilist import Media, search_media
from ..services.anidle_evaluator import (
    AnidleEvaluationService,
    AnidleGuessEvaluationPayload,
    AnidleGuessEvaluationResponse,
    AnidleListFeedbackItem,
    AnidleScalarFeedback,
)

router = APIRouter()
logger = logging.getLogger(__name__)


def _parse_date(value: Optional[str]) -> date:
    if not value:
        return date.today()
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.") from exc


async def _resolve_user_context(request: Request) -> Optional[UserContext]:
    session_token = request.cookies.get("guesssenpai_session")
    if not session_token:
        return None
    manager = await get_session_manager()
    session = await manager.get_session(session_token)
    if not session:
        return None
    return UserContext(user_id=session.user_id, username=session.username, access_token=session.access_token)


async def _require_session(request: Request) -> SessionData:
    session_token = request.cookies.get("guesssenpai_session")
    if not session_token:
        raise HTTPException(status_code=401, detail="Authentication required")
    manager = await get_session_manager()
    session = await manager.get_session(session_token)
    if not session:
        raise HTTPException(status_code=401, detail="Authentication required")
    return session


async def _optional_session(request: Request) -> Optional[SessionData]:
    session_token = request.cookies.get("guesssenpai_session")
    if not session_token:
        return None
    manager = await get_session_manager()
    session = await manager.get_session(session_token)
    return session


class TitleSuggestion(BaseModel):
    id: int
    title: str


class TitleSuggestionResponse(BaseModel):
    results: list[TitleSuggestion]


class CharacterSuggestion(BaseModel):
    id: int
    title: str
    canonical: Optional[str] = None
    image: Optional[str] = None


class CharacterSuggestionResponse(BaseModel):
    results: list[CharacterSuggestion]


class ArchiveIndexResponse(BaseModel):
    dates: list[str]


class GuessVerificationPayload(BaseModel):
    media_id: int
    guess: str
    guess_media_id: Optional[int] = None
    character_guess: Optional[str] = None
    guess_character_id: Optional[int] = None
    season: Optional[str] = None
    season_year: Optional[int] = None


class GuessVerificationResponse(BaseModel):
    correct: bool
    anime_match: bool
    character_match: Optional[bool] = None
    match: Optional[str] = None
    character: Optional[str] = None
    character_id: Optional[int] = None
    season_match: Optional[bool] = None
    season_year_match: Optional[bool] = None


def _generate_archive_dates(history_days: int) -> list[str]:
    today = date.today()
    total_days = max(history_days, 0)
    return [
        (today - timedelta(days=offset)).isoformat()
        for offset in range(total_days)
    ]
def _normalize_season_label(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    normalized = value.replace("_", " ").replace("-", " ").strip().casefold()
    if not normalized:
        return None
    token = normalized.split()[0]
    aliases = {
        "winter": "WINTER",
        "spring": "SPRING",
        "summer": "SUMMER",
        "fall": "FALL",
        "autumn": "FALL",
    }
    resolved = aliases.get(token)
    if resolved:
        return resolved
    upper = token.upper()
    return upper if upper in {"WINTER", "SPRING", "SUMMER", "FALL"} else None
@router.get("/poster/{media_id}/image")
async def get_poster_image(
    media_id: int,
    hints: int = Query(default=0, ge=0, description="Number of hints revealed"),
) -> Response:
    try:
        content, mime = await puzzle_engine.generate_poster_image(media_id, hints)
    except puzzle_engine.PosterImageError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    return Response(content=content, media_type=mime)


@router.get(
    "/today",
    response_model=DailyPuzzleResponse,
    summary="Fetch today’s GuessSenpai puzzles",
)
async def get_today_puzzles(
    request: Request,
    d: Optional[str] = Query(default=None, description="Override date in YYYY-MM-DD format"),
) -> DailyPuzzleResponse:
    day = _parse_date(d)
    user_ctx = await _resolve_user_context(request)
    puzzles = await get_daily_puzzle(
        day,
        user=user_ctx,
        include_guess_opening=settings.animethemes_enabled,
    )
    return puzzles


@router.get("/progress", response_model=DailyProgressPayload)
async def get_progress(request: Request, d: Optional[str] = Query(default=None)) -> DailyProgressPayload:
    session = await _optional_session(request)
    day = _parse_date(d)
    if not session:
        return DailyProgressPayload(date=day, progress={})
    return await load_daily_progress(session.user_id, day)


@router.put("/progress", response_model=DailyProgressPayload)
async def put_progress(request: Request, payload: DailyProgressPayload) -> DailyProgressPayload:
    session = await _optional_session(request)
    if not session:
        return DailyProgressPayload(date=payload.date, progress=payload.progress)
    return await merge_daily_progress(session.user_id, payload)


@router.get("/streak", response_model=StreakPayload)
async def get_streak(request: Request) -> StreakPayload:
    session = await _require_session(request)
    return await load_streak(session.user_id)


@router.put("/streak", response_model=StreakPayload)
async def put_streak(request: Request, payload: StreakPayload) -> StreakPayload:
    session = await _require_session(request)
    return await store_streak(session.user_id, payload)


@router.get("/stats", response_model=PuzzleStatsPayload)
async def get_stats(request: Request) -> PuzzleStatsPayload:
    session = await _require_session(request)
    cache = await get_cache(settings.redis_url)
    streak = await load_streak(session.user_id)
    recent_ids = await puzzle_engine._get_recent_media(cache, session.user_id)
    history = await load_progress_history(session.user_id)
    aggregate = await load_progress_aggregate(session.user_id)
    completion_rate = (
        aggregate.completed_games / aggregate.total_games if aggregate.total_games else 0.0
    )

    recent_media: list[RecentMediaSummary] = []
    for media_id in recent_ids:
        try:
            media = await puzzle_engine._load_media_details(media_id, cache, settings)
        except Exception:
            continue
        cover_image = None
        if media.coverImage:
            cover_image = (
                media.coverImage.extraLarge
                or media.coverImage.large
                or media.coverImage.medium
            )
        recent_media.append(
            RecentMediaSummary(id=media.id, title=media.title, coverImage=cover_image)
        )

    return PuzzleStatsPayload(
        streak=streak,
        completion_rate=completion_rate,
        total_games=aggregate.total_games,
        completed_games=aggregate.completed_games,
        active_days=aggregate.active_days,
        history=history,
        recent_media_ids=recent_ids,
        recent_media=recent_media,
    )


@router.post("/verify", response_model=GuessVerificationResponse)
async def verify_guess(payload: GuessVerificationPayload) -> GuessVerificationResponse:
    guess = payload.guess.strip()
    if not guess:
        raise HTTPException(status_code=400, detail="Guess cannot be empty")

    character_guess = (
        payload.character_guess.strip() if payload.character_guess else None
    )

    cache = await get_cache(settings.redis_url)
    try:
        media = await puzzle_engine._load_media_details(payload.media_id, cache, settings)
    except Exception as exc:  # pragma: no cover - defensive catch for upstream failures
        raise HTTPException(status_code=404, detail="Media not found") from exc

    def _normalize(value: str) -> str:
        return " ".join(value.split()).casefold()

    normalized_target_season = _normalize_season_label(getattr(media, "season", None))
    target_season_year = getattr(media, "seasonYear", None)
    if target_season_year is None:
        target_season_year = (getattr(media, "startDate", None) or {}).get("year")

    request_season = _normalize_season_label(payload.season)
    season_match: Optional[bool] = None
    if request_season is not None:
        season_match = (
            request_season == normalized_target_season
            if normalized_target_season is not None
            else None
        )

    season_year_match: Optional[bool] = None
    if payload.season_year is not None:
        if target_season_year is not None:
            season_year_match = int(payload.season_year) == int(target_season_year)
        else:
            season_year_match = None

    variants = _title_variants(media)
    normalized_guess = _normalize(guess)
    normalized_variants = {_normalize(variant) for variant in variants if variant}

    guess_media = None
    if payload.guess_media_id:
        try:
            guess_media = await puzzle_engine._load_media_details(
                payload.guess_media_id, cache, settings
            )
        except Exception:  # pragma: no cover - fallback to text matching
            guess_media = None

    match = None
    anime_match = False
    if guess_media is not None:
        guess_variants = _title_variants(guess_media)
        for variant in guess_variants:
            if variant and _normalize(variant) in normalized_variants:
                match = variant
                anime_match = True
                break
        if guess_media.id == media.id and match is None:
            match = _choose_answer(media)
            anime_match = True

    if match is None:
        for variant in variants:
            if variant and _normalize(variant) == normalized_guess:
                match = variant
                anime_match = True
                break

    if match is not None:
        anime_match = True

    character_match: Optional[bool] = None
    resolved_character: Optional[str] = None
    resolved_character_id: Optional[int] = None
    evaluate_character = (
        payload.guess_character_id is not None or character_guess is not None
    )

    if evaluate_character:
        target_edge = puzzle_engine._select_character_edge(media)
        if target_edge and target_edge.node:
            resolved_character_id = target_edge.node.id
            resolved_character = (
                target_edge.node.name.full
                or target_edge.node.name.userPreferred
                or target_edge.node.name.native
                or None
            )

            matched = False
            evaluated = False

            if payload.guess_character_id is not None:
                evaluated = True
                if payload.guess_character_id == resolved_character_id:
                    matched = True

            normalized_targets: set[str] = set()
            base_names = [
                target_edge.node.name.full,
                target_edge.node.name.userPreferred,
                target_edge.node.name.native,
            ]

            alias_values: list[str] = []
            if character_guess:
                session_factory = get_session_factory()
                async with session_factory() as session:
                    alias_values = await character_index.load_character_aliases(
                        session, resolved_character_id
                    )
            for value in base_names + alias_values:
                normalized = character_index.normalize_name(value)
                if normalized:
                    normalized_targets.add(normalized)

            if character_guess:
                normalized_character_guess = character_index.normalize_name(
                    character_guess
                )
                if normalized_character_guess:
                    evaluated = True
                    if normalized_character_guess in normalized_targets:
                        matched = True

            character_match = matched if evaluated else None
        else:
            character_match = None

    correct = anime_match
    if character_match is not None:
        correct = correct and character_match

    return GuessVerificationResponse(
        correct=correct,
        anime_match=anime_match,
        character_match=character_match,
        match=match,
        character=resolved_character,
        character_id=resolved_character_id,
        season_match=season_match,
        season_year_match=season_year_match,
    )


@router.post("/anidle/evaluate", response_model=AnidleGuessEvaluationResponse)
async def evaluate_anidle_guess(
    request: Request, payload: AnidleGuessEvaluationPayload
) -> AnidleGuessEvaluationResponse:
    cache = await get_cache(settings.redis_url)
    session_factory = get_session_factory()
    user_ctx = await _resolve_user_context(request)
    service = AnidleEvaluationService(
        cache=cache, session_factory=session_factory, user=user_ctx
    )

    start = perf_counter()
    try:
        return await service.evaluate_guess(payload)
    finally:
        duration_ms = (perf_counter() - start) * 1000
        metrics = service.metrics
        logger.info(
            "anidle.evaluate.single",
            extra={
                "duration_ms": round(duration_ms, 3),
                "count": 1,
                **metrics,
            },
        )


@router.post(
    "/anidle/evaluate/batch",
    response_model=list[AnidleGuessEvaluationResponse],
)
async def evaluate_anidle_guess_batch(
    request: Request, payloads: list[AnidleGuessEvaluationPayload]
) -> list[AnidleGuessEvaluationResponse]:
    cache = await get_cache(settings.redis_url)
    session_factory = get_session_factory()
    user_ctx = await _resolve_user_context(request)
    service = AnidleEvaluationService(
        cache=cache, session_factory=session_factory, user=user_ctx
    )

    start = perf_counter()
    try:
        return [await service.evaluate_guess(payload) for payload in payloads]
    finally:
        duration_ms = (perf_counter() - start) * 1000
        metrics = service.metrics
        logger.info(
            "anidle.evaluate.batch",
            extra={
                "duration_ms": round(duration_ms, 3),
                "count": len(payloads),
                **metrics,
            },
        )


@router.get("/search-titles", response_model=TitleSuggestionResponse)
async def search_titles(
    request: Request,
    q: str = Query(..., description="Search term for an anime title"),
    limit: int = Query(default=8, ge=1, le=20),
) -> TitleSuggestionResponse:
    search_term = q.strip()
    if not search_term:
        return TitleSuggestionResponse(results=[])
    session_factory = get_session_factory()
    async with session_factory() as session:
        index_results = await title_index.search_titles(session, search_term, limit=limit)

    if index_results:
        return TitleSuggestionResponse(
            results=[TitleSuggestion(id=item.media_id, title=item.title) for item in index_results]
        )

    user_ctx = await _resolve_user_context(request)
    token = user_ctx.access_token if user_ctx else None
    cache = await get_cache(settings.redis_url)
    remote_results = await search_media(search_term, limit=limit, token=token)
    for pair in remote_results:
        try:
            await puzzle_engine._load_media_details(pair.id, cache, settings)
        except Exception:
            continue

    async with session_factory() as session:
        refreshed = await title_index.search_titles(session, search_term, limit=limit)

    if refreshed:
        return TitleSuggestionResponse(
            results=[TitleSuggestion(id=item.media_id, title=item.title) for item in refreshed]
        )

    # No matches even after remote lookup; return empty set.
    return TitleSuggestionResponse(results=[])


@router.get("/search-characters", response_model=CharacterSuggestionResponse)
async def search_characters(
    q: str = Query(..., description="Search term for an anime character"),
    limit: int = Query(default=8, ge=1, le=20),
) -> CharacterSuggestionResponse:
    search_term = q.strip()
    if not search_term:
        return CharacterSuggestionResponse(results=[])

    session_factory = get_session_factory()
    async with session_factory() as session:
        matches = await character_index.search_characters(session, search_term, limit=limit)

    suggestions = [
        CharacterSuggestion(
            id=match.character_id,
            title=match.name,
            canonical=match.canonical_name,
            image=match.image,
        )
        for match in matches
    ]
    return CharacterSuggestionResponse(results=suggestions)


@router.get("/archive", response_model=ArchiveIndexResponse)
async def get_archive_dates() -> ArchiveIndexResponse:
    dates = _generate_archive_dates(settings.puzzle_history_days)
    return ArchiveIndexResponse(dates=dates)


__all__ = [
    "AnidleGuessEvaluationPayload",
    "AnidleGuessEvaluationResponse",
    "AnidleScalarFeedback",
    "AnidleListFeedbackItem",
]
