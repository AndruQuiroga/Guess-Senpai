from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime, timedelta, timezone
from time import perf_counter
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, Request, Response
from sqlalchemy import select
from ..db.models import DailyPuzzleSet
from pydantic import BaseModel, Field

from ..core.config import settings
from ..core.database import get_session_factory
from ..services.poster_modified import Modification
from ..puzzles import engine as puzzle_engine
from ..puzzles.engine import UserContext, _choose_answer, _title_variants, get_daily_puzzle
from ..puzzles.models import (
    AnidlePracticeResponse,
    DailyProgressPayload,
    DailyPuzzleResponse,
    PuzzleStatsPayload,
    RecentMediaSummary,
    StreakPayload,
    UtcDatetime,
)
from ..services import anidle_practice, character_index, title_index
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
from ..services.anilist import AniListError, Media, MediaTitlePair, search_media
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
        return datetime.now(timezone.utc).date()
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


class DailyAvailabilityResponse(BaseModel):
    round_max_points: dict[str, list[int]] = Field(default_factory=dict)
    date: date
    reset_at: UtcDatetime
    published: bool
    available_modes: list[str]
    guess_the_opening_enabled: bool
    puzzle_id: str
    rules_version: str


class GuessVerificationPayload(BaseModel):
    media_id: int
    guess: str
    guess_media_id: Optional[int] = None
    character_guess: Optional[str] = None
    guess_character_id: Optional[int] = None
    # The character on the card being checked; without it the anime's default
    # featured character is used (legacy single-character play).
    target_character_id: Optional[int] = None
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
    difficulty: int = Query(default=0, ge=0, le=3, description="Round difficulty (1-3) for the tiered zoom ladder"),
    modification: Optional[Modification] = Query(default=None),
) -> Response:
    try:
        if modification:
            content, mime = await puzzle_engine.generate_modified_poster_image(media_id, hints, modification)
        else:
            content, mime = await puzzle_engine.generate_poster_image(media_id, hints, difficulty)
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
    try:
        puzzles = await get_daily_puzzle(day, include_guess_opening=settings.animethemes_enabled)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return puzzles


@router.get("/progress", response_model=DailyProgressPayload)
async def get_progress(request: Request, d: Optional[str] = None, puzzle_id: Optional[str] = None, rules_version: Optional[str] = None, account_user_id: Optional[int] = None) -> DailyProgressPayload:
    session = await _optional_session(request)
    day = _parse_date(d)
    if isinstance(account_user_id, int) and (not session or session.user_id != account_user_id):
        raise HTTPException(status_code=409, detail="Account changed; reload before syncing progress")
    if not session:
        return DailyProgressPayload(date=day, puzzle_id=puzzle_id, rules_version=rules_version, progress={})
    result = await load_daily_progress(session.user_id, day, puzzle_id, rules_version)
    return result.model_copy(update={"account_user_id": session.user_id})


@router.get("/availability", response_model=DailyAvailabilityResponse)
async def get_daily_availability() -> DailyAvailabilityResponse:
    day = datetime.now(timezone.utc).date()
    factory = get_session_factory()
    async with factory() as session:
        published = await session.get(DailyPuzzleSet, day)
    modes = list(published.available_modes) if published else ["anidle", "poster_zoomed", "redacted_synopsis", "character_silhouette"]
    return DailyAvailabilityResponse(
        round_max_points=puzzle_engine.daily_round_max_points(published.content if published else {}, modes),
        date=day,
        reset_at=published.reset_at if published else datetime.combine(day + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc),
        published=published is not None,
        available_modes=modes,
        guess_the_opening_enabled="guess_the_opening" in modes,
        puzzle_id=puzzle_engine.daily_puzzle_id(day, published.content if published else None),
        rules_version=published.rules_version if published else "1",
    )


@router.put("/progress", response_model=DailyProgressPayload)
async def put_progress(request: Request, payload: DailyProgressPayload) -> DailyProgressPayload:
    session = await _optional_session(request)
    if payload.account_user_id is not None and (not session or session.user_id != payload.account_user_id):
        raise HTTPException(status_code=409, detail="Account changed; reload before syncing progress")
    if payload.puzzle_id:
        async with get_session_factory()() as db_session:
            published = await db_session.get(DailyPuzzleSet, payload.date)
        if (
            not published
            or payload.puzzle_id != puzzle_engine.daily_puzzle_id(payload.date, published.content)
            or payload.rules_version != published.rules_version
        ):
            raise HTTPException(status_code=409, detail="Progress does not match a published puzzle")
    if not session:
        return payload
    result = await merge_daily_progress(session.user_id, payload)
    return result.model_copy(update={"account_user_id": session.user_id})


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
    await puzzle_engine._warm_media_details(recent_ids, cache, settings)
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
    character_guess = (
        payload.character_guess.strip() if payload.character_guess else None
    )
    # A card may be checked for its character alone (anime left blank).
    if not guess and not character_guess and payload.guess_character_id is None:
        raise HTTPException(status_code=400, detail="Guess cannot be empty")

    cache = await get_cache(settings.redis_url)
    # One AniList request covers both the answer and the guess on a cold cache.
    await puzzle_engine._warm_media_details(
        [payload.media_id] + ([payload.guess_media_id] if payload.guess_media_id else []),
        cache,
        settings,
    )
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
        target_edge = None
        if payload.target_character_id is not None:
            target_edge = next(
                (
                    edge
                    for edge in (media.characters.edges if media.characters else [])
                    if edge.node and edge.node.id == payload.target_character_id
                ),
                None,
            )
            if target_edge is None:
                raise HTTPException(status_code=404, detail="Character not found for this anime")
        else:
            # Legacy single-character play: the anime's featured character.
            target_edge = puzzle_engine._featured_character_edge(media, set())
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


@router.get(
    "/anidle/practice",
    response_model=AnidlePracticeResponse,
    summary="Fetch a fresh Unlimited Anidle practice game",
)
async def get_anidle_practice(
    request: Request,
    exclude: Optional[List[int]] = Query(
        default=None,
        max_length=anidle_practice.MAX_EXCLUDED_IDS,
        description="Recently played media ids to avoid repeating",
    ),
    source: anidle_practice.PracticeSource = Query(
        default="popular",
        description="'popular' for the shared pool, 'list' for the signed-in player's AniList list",
    ),
) -> AnidlePracticeResponse:
    user_ctx: Optional[UserContext] = None
    if source == "list":
        user_ctx = await _resolve_user_context(request)
        if user_ctx is None:
            raise HTTPException(status_code=401, detail="Sign in with AniList to practise from your list")
    try:
        return await anidle_practice.build_practice_game(exclude, user=user_ctx)
    except anidle_practice.EmptyPracticeList as exc:
        raise HTTPException(
            status_code=404,
            detail="Your AniList list has no watched anime yet. Mark some as watching or completed.",
        ) from exc
    except AniListError as exc:
        detail = "Couldn't read your AniList list right now" if user_ctx else "AniList is unavailable right now"
        raise HTTPException(status_code=502, detail=detail) from exc
    except (ValueError, LookupError) as exc:
        raise HTTPException(status_code=503, detail="No practice puzzle available right now") from exc


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

    # Index miss: ask AniList once per term, then serve the cached answer
    # (including "no results") so repeat searches never leave the server.
    cache = await get_cache(settings.redis_url)
    search_key = puzzle_engine._search_cache_key(search_term, limit)
    cached_pairs = await cache.get(search_key)
    if isinstance(cached_pairs, list):
        remote_results = [MediaTitlePair.model_validate(item) for item in cached_pairs]
    else:
        user_ctx = await _resolve_user_context(request)
        token = user_ctx.access_token if user_ctx else None
        remote_results = await search_media(search_term, limit=limit, token=token)
        await cache.set(
            search_key,
            [pair.model_dump(mode="json") for pair in remote_results],
            settings.anilist_cache_ttl_seconds,
        )
        await _warm_title_index([pair.id for pair in remote_results], cache)

        async with session_factory() as session:
            refreshed = await title_index.search_titles(session, search_term, limit=limit)
        if refreshed:
            return TitleSuggestionResponse(
                results=[TitleSuggestion(id=item.media_id, title=item.title) for item in refreshed]
            )

    # AniList matched on something the index cannot (abbreviations, synonyms),
    # so return its own titles rather than nothing.
    suggestions: List[TitleSuggestion] = []
    for pair in remote_results[:limit]:
        title = pair.title.userPreferred or pair.title.english or pair.title.romaji
        if title:
            suggestions.append(TitleSuggestion(id=pair.id, title=title))
    return TitleSuggestionResponse(results=suggestions)


_WARM_CONCURRENCY = 4


async def _warm_title_index(media_ids: List[int], cache) -> None:
    """Load details for search hits so later searches and guesses stay local."""
    # One batched AniList request for every hit; the loads below hit the cache.
    await puzzle_engine._warm_media_details(media_ids, cache, settings)
    semaphore = asyncio.Semaphore(_WARM_CONCURRENCY)

    async def warm(media_id: int) -> None:
        async with semaphore:
            try:
                await puzzle_engine._load_media_details(media_id, cache, settings)
            except Exception:
                logger.debug("Failed to warm title index for media %s", media_id)

    await asyncio.gather(*(warm(media_id) for media_id in media_ids))


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
    factory = get_session_factory()
    async with factory() as session:
        rows = (await session.scalars(select(DailyPuzzleSet.puzzle_date).order_by(DailyPuzzleSet.puzzle_date.desc()))).all()
    return ArchiveIndexResponse(dates=[value.isoformat() for value in rows])


__all__ = [
    "AnidleGuessEvaluationPayload",
    "AnidleGuessEvaluationResponse",
    "AnidleScalarFeedback",
    "AnidleListFeedbackItem",
]
