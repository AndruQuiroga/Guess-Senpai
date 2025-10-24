from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import List, Literal, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from ..core.config import settings
from ..puzzles import engine as puzzle_engine
from ..puzzles.engine import UserContext, _title_variants, get_daily_puzzle
from ..puzzles.models import (
    DailyProgressPayload,
    DailyPuzzleResponse,
    PuzzleStatsPayload,
    RecentMediaSummary,
    StreakPayload,
)
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
from ..services.anilist import MediaTitlePair, search_media

router = APIRouter()


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


class TitleSuggestion(BaseModel):
    id: int
    title: str


class TitleSuggestionResponse(BaseModel):
    results: list[TitleSuggestion]


class ArchiveIndexResponse(BaseModel):
    dates: list[str]


class AnidleScalarFeedback(BaseModel):
    guess: Optional[int] = None
    target: Optional[int] = None
    status: Literal["match", "higher", "lower", "unknown"]


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
    genres: List[AnidleListFeedbackItem]
    tags: List[AnidleListFeedbackItem]


class GuessVerificationPayload(BaseModel):
    media_id: int
    guess: str


class GuessVerificationResponse(BaseModel):
    correct: bool
    match: Optional[str] = None


def _generate_archive_dates(history_days: int) -> list[str]:
    today = date.today()
    total_days = max(history_days, 0)
    return [
        (today - timedelta(days=offset)).isoformat()
        for offset in range(total_days)
    ]


def _normalize_text(value: str) -> str:
    return " ".join(value.split()).casefold()


def _dedupe_preserve_order(values: List[str]) -> List[str]:
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


def _build_scalar_feedback(
    guess_value: Optional[int],
    target_value: Optional[int],
) -> AnidleScalarFeedback:
    if guess_value is None or target_value is None:
        status: Literal["match", "higher", "lower", "unknown"] = "unknown"
    elif guess_value == target_value:
        status = "match"
    elif guess_value > target_value:
        status = "higher"
    else:
        status = "lower"
    return AnidleScalarFeedback(guess=guess_value, target=target_value, status=status)


def _build_list_feedback(
    guess_values: List[str],
    target_values: List[str],
) -> List[AnidleListFeedbackItem]:
    normalized_targets = {value.casefold() for value in target_values if value}
    feedback: List[AnidleListFeedbackItem] = []
    for value in _dedupe_preserve_order(guess_values):
        status: Literal["match", "miss"] = (
            "match" if value.casefold() in normalized_targets else "miss"
        )
        feedback.append(AnidleListFeedbackItem(value=value, status=status))
    return feedback


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
    session = await _require_session(request)
    day = _parse_date(d)
    return await load_daily_progress(session.user_id, day)


@router.put("/progress", response_model=DailyProgressPayload)
async def put_progress(request: Request, payload: DailyProgressPayload) -> DailyProgressPayload:
    session = await _require_session(request)
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

    cache = await get_cache(settings.redis_url)
    try:
        media = await puzzle_engine._load_media_details(payload.media_id, cache, settings)
    except Exception as exc:  # pragma: no cover - defensive catch for upstream failures
        raise HTTPException(status_code=404, detail="Media not found") from exc

    def _normalize(value: str) -> str:
        return " ".join(value.split()).casefold()

    variants = _title_variants(media)
    normalized_guess = _normalize(guess)
    match = None
    for variant in variants:
        if variant and _normalize(variant) == normalized_guess:
            match = variant
            break

    return GuessVerificationResponse(correct=match is not None, match=match)


@router.post("/anidle/evaluate", response_model=AnidleGuessEvaluationResponse)
async def evaluate_anidle_guess(
    request: Request, payload: AnidleGuessEvaluationPayload
) -> AnidleGuessEvaluationResponse:
    guess_value = payload.guess.strip()
    if not guess_value:
        raise HTTPException(status_code=400, detail="Guess cannot be empty")

    cache = await get_cache(settings.redis_url)
    try:
        target_media = await puzzle_engine._load_media_details(
            payload.puzzle_media_id, cache, settings
        )
    except Exception as exc:  # pragma: no cover - upstream failures
        raise HTTPException(status_code=404, detail="Puzzle media not found") from exc

    guess_media = None
    if payload.guess_media_id:
        try:
            guess_media = await puzzle_engine._load_media_details(
                payload.guess_media_id, cache, settings
            )
        except Exception:
            guess_media = None

    normalized_guess = _normalize_text(guess_value)

    if guess_media is None:
        user_ctx = await _resolve_user_context(request)
        token = user_ctx.access_token if user_ctx else None
        search_results = await search_media(guess_value, limit=5, token=token)
        best_candidate = None
        for pair in search_results:
            try:
                candidate = await puzzle_engine._load_media_details(
                    pair.id, cache, settings
                )
            except Exception:
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
    target_score = target_media.averageScore
    target_genres = [genre for genre in target_media.genres if genre]
    target_tags = puzzle_engine._extract_top_tags(target_media)

    if guess_media is not None:
        resolved_title = (
            guess_media.title.userPreferred
            or guess_media.title.english
            or guess_media.title.romaji
            or guess_media.title.native
            or guess_value
        )
        guess_year = guess_media.seasonYear or (guess_media.startDate or {}).get("year")
        guess_score = guess_media.averageScore
        guess_genres = [genre for genre in guess_media.genres if genre]
        guess_tags = puzzle_engine._extract_top_tags(guess_media)
        correct = guess_media.id == target_media.id
    else:
        resolved_title = guess_value
        guess_year = None
        guess_score = None
        guess_genres = []
        guess_tags = []
        correct = any(
            variant and _normalize_text(variant) == normalized_guess
            for variant in puzzle_engine._title_variants(target_media)
        )

    return AnidleGuessEvaluationResponse(
        title=resolved_title,
        correct=correct,
        year=_build_scalar_feedback(guess_year, target_year),
        average_score=_build_scalar_feedback(guess_score, target_score),
        genres=_build_list_feedback(guess_genres, target_genres),
        tags=_build_list_feedback(guess_tags, target_tags),
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
    user_ctx = await _resolve_user_context(request)
    token = user_ctx.access_token if user_ctx else None
    media = await search_media(search_term, limit=limit, token=token)

    def _resolve_title(pair: MediaTitlePair) -> str:
        title = pair.title
        return (
            title.userPreferred
            or title.english
            or title.romaji
            or title.native
            or ""
        )

    results: list[TitleSuggestion] = []
    for item in media:
        resolved = _resolve_title(item)
        if resolved:
            results.append(TitleSuggestion(id=item.id, title=resolved))
    return TitleSuggestionResponse(results=results)


@router.get("/archive", response_model=ArchiveIndexResponse)
async def get_archive_dates() -> ArchiveIndexResponse:
    dates = _generate_archive_dates(settings.puzzle_history_days)
    return ArchiveIndexResponse(dates=dates)
