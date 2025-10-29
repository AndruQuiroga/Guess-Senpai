from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any, List, Literal, Optional

from fastapi import APIRouter, HTTPException, Query, Request, Response
from pydantic import BaseModel

from ..core.config import settings
from ..core.database import get_session_factory
from ..puzzles import engine as puzzle_engine
from ..puzzles.engine import (
    UserContext,
    _choose_answer,
    _title_variants,
    get_daily_puzzle,
)
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


def _format_enum_label(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    normalized = value.replace("_", " ").replace("-", " ").strip()
    if not normalized:
        return None
    return normalized.title()


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


def _extract_studio_names(media: Media) -> List[str]:
    studios = getattr(media, "studios", None)
    if not studios or not getattr(studios, "edges", None):
        return []
    primary: List[str] = []
    secondary: List[str] = []
    for edge in studios.edges:
        if not edge:
            continue
        node: Any = getattr(edge, "node", None)
        if not node:
            continue
        name = getattr(node, "name", None)
        if not name:
            continue
        bucket = primary if getattr(edge, "isMain", False) else secondary
        bucket.append(name)
    return _dedupe_preserve_order(primary + secondary)


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
    guess_value = payload.guess.strip()
    if not guess_value:
        raise HTTPException(status_code=400, detail="Guess cannot be empty")

    cache = await get_cache(settings.redis_url)
    session_factory = get_session_factory()
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

    index_matches: list[title_index.TitleMatch] = []
    if guess_media is None:
        async with session_factory() as session:
            index_matches = await title_index.search_titles(session, guess_value, limit=5)
        best_candidate = None
        for match in index_matches:
            try:
                candidate = await puzzle_engine._load_media_details(
                    match.media_id, cache, settings
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

    if guess_media is None and not index_matches:
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
        guess_genres = []
        guess_tags = []
        guess_studios = []
        guess_source = None
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
