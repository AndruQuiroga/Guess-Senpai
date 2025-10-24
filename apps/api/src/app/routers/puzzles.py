from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from ..core.config import settings
from ..puzzles.engine import UserContext, get_daily_puzzle
from ..puzzles.models import DailyProgressPayload, DailyPuzzleResponse, StreakPayload
from ..services.progress import (
    load_daily_progress,
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


def _generate_archive_dates(history_days: int) -> list[str]:
    today = date.today()
    total_days = max(history_days, 0)
    return [
        (today - timedelta(days=offset)).isoformat()
        for offset in range(total_days)
    ]


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
