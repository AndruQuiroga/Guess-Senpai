from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from ..services.preferences import (
    UserPreferences,
    load_user_preferences,
    update_user_preferences,
)
from ..services.session import SessionData, get_session_manager

router = APIRouter()


async def _require_session(request: Request) -> SessionData:
    token = request.cookies.get("guesssenpai_session")
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    manager = await get_session_manager()
    session = await manager.get_session(token)
    if not session:
        raise HTTPException(status_code=401, detail="Authentication required")
    return session


@router.get("/preferences", response_model=UserPreferences)
async def get_preferences(request: Request) -> UserPreferences:
    session = await _require_session(request)
    return await load_user_preferences(session.user_id)


@router.put("/preferences", response_model=UserPreferences)
async def put_preferences(
    request: Request, payload: UserPreferences
) -> UserPreferences:
    session = await _require_session(request)
    return await update_user_preferences(session.user_id, payload)
