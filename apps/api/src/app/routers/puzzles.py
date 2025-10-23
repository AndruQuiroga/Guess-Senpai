from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from ..core.config import settings
from ..puzzles.engine import UserContext, get_daily_puzzle
from ..puzzles.models import DailyPuzzleResponse
from ..services.session import get_session_manager

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
