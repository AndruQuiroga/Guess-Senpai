from __future__ import annotations

import time
from typing import Optional
from urllib.parse import urlencode

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import JSONResponse, RedirectResponse

from ..core.config import settings
from ..services import anilist
from ..services.session import SessionData, get_session_manager


router = APIRouter(prefix="/auth/anilist", tags=["auth"])


def _require_oauth_config() -> None:
    if not (settings.anilist_client_id and settings.anilist_client_secret and settings.anilist_redirect_uri):
        raise HTTPException(status_code=500, detail="AniList OAuth is not configured")


@router.get("/login")
async def login(redirect_to: Optional[str] = Query(default=None)) -> RedirectResponse:
    _require_oauth_config()
    manager = await get_session_manager()
    state = await manager.issue_state(redirect_to)
    params = {
        "client_id": settings.anilist_client_id,
        "redirect_uri": str(settings.anilist_redirect_uri),
        "response_type": "code",
        "state": state,
    }
    authorize_url = f"https://anilist.co/api/v2/oauth/authorize?{urlencode(params)}"
    return RedirectResponse(authorize_url)


@router.get("/callback")
async def callback(code: str, state: str) -> RedirectResponse:
    _require_oauth_config()
    manager = await get_session_manager()
    state_data = await manager.consume_state(state)
    if not state_data:
        raise HTTPException(status_code=400, detail="Invalid or expired state parameter")

    token_response = await anilist.exchange_code_for_token(
        code=code,
        client_id=settings.anilist_client_id,
        client_secret=settings.anilist_client_secret,
        redirect_uri=str(settings.anilist_redirect_uri),
    )

    user = token_response.user or {}
    user_id = user.get("id")
    if not user_id:
        raise HTTPException(status_code=500, detail="AniList token response missing user information")

    now = time.time()
    expires_at = now + token_response.expires_in
    avatar = None
    avatar_dict = user.get("avatar") if isinstance(user.get("avatar"), dict) else None
    if avatar_dict:
        avatar = avatar_dict.get("large") or avatar_dict.get("medium")

    session_data = SessionData(
        user_id=user_id,
        username=user.get("name"),
        avatar=avatar,
        access_token=token_response.access_token,
        expires_at=expires_at,
        created_at=now,
        refresh_token=token_response.refresh_token,
    )
    signed_session = await manager.issue_session(session_data)

    redirect_target = state_data.redirect_to or (settings.frontend_base_url or "http://localhost:3000")
    response = RedirectResponse(redirect_target)
    response.set_cookie(
        "guesssenpai_session",
        signed_session,
        secure=False,
        httponly=True,
        samesite="lax",
        max_age=token_response.expires_in,
    )
    return response


@router.post("/logout")
async def logout(request: Request) -> JSONResponse:
    session_cookie = request.cookies.get("guesssenpai_session")
    if session_cookie:
        manager = await get_session_manager()
        await manager.revoke_session(session_cookie)
    response = JSONResponse({"ok": True})
    response.delete_cookie("guesssenpai_session")
    return response


REFRESH_THRESHOLD_SECONDS = 5 * 60


@router.post("/refresh")
async def refresh(request: Request) -> JSONResponse:
    _require_oauth_config()
    session_cookie = request.cookies.get("guesssenpai_session")
    if not session_cookie:
        raise HTTPException(status_code=401, detail="Not authenticated")

    manager = await get_session_manager()
    session = await manager.get_session(session_cookie)
    if not session or not session.session_id:
        raise HTTPException(status_code=401, detail="Session expired")

    now = time.time()
    if session.refresh_expires_at and session.refresh_expires_at <= now:
        await manager.revoke_session(session_cookie)
        raise HTTPException(status_code=401, detail="Refresh token expired")

    time_remaining = session.expires_at - now
    if time_remaining > REFRESH_THRESHOLD_SECONDS:
        return JSONResponse({"refreshed": False, "expiresAt": session.expires_at})

    if not session.refresh_token:
        raise HTTPException(status_code=400, detail="Session cannot be refreshed")

    token_response = await anilist.refresh_access_token(
        refresh_token=session.refresh_token,
        client_id=settings.anilist_client_id,
        client_secret=settings.anilist_client_secret,
    )

    new_expires_at = now + token_response.expires_in
    refresh_token_value = token_response.refresh_token or session.refresh_token

    updated_session = await manager.update_session_tokens(
        session.session_id,
        access_token=token_response.access_token,
        expires_at=new_expires_at,
        refresh_token=refresh_token_value,
        refresh_expires_at=session.refresh_expires_at,
    )
    if not updated_session:
        raise HTTPException(status_code=401, detail="Session expired")

    response = JSONResponse({"refreshed": True, "expiresAt": updated_session.expires_at})
    max_age = int(max(updated_session.expires_at - time.time(), 1))
    response.set_cookie(
        "guesssenpai_session",
        session_cookie,
        secure=False,
        httponly=True,
        samesite="lax",
        max_age=max_age,
    )
    return response
@router.get("/me")
async def current_user(request: Request) -> JSONResponse:
    session_cookie = request.cookies.get("guesssenpai_session")
    if not session_cookie:
        return JSONResponse({"authenticated": False})
    manager = await get_session_manager()
    session = await manager.get_session(session_cookie)
    if not session:
        return JSONResponse({"authenticated": False})
    return JSONResponse(
        {
            "authenticated": True,
            "user": {
                "id": session.user_id,
                "username": session.username,
                "avatar": session.avatar,
            },
        }
    )
