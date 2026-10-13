import httpx
import pytest
from fastapi import FastAPI

from app.routers import auth


@pytest.fixture
def auth_app():
    app = FastAPI()
    app.include_router(auth.router)
    return app


@pytest.mark.asyncio
async def test_unconfigured_login_and_missing_session_are_truthful(auth_app, monkeypatch):
    monkeypatch.setattr(auth.settings, "anilist_client_id", None)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app), base_url="http://test") as client:
        assert (await client.get("/auth/anilist/login")).status_code == 500
        assert (await client.get("/auth/anilist/me")).json() == {"authenticated": False}


@pytest.mark.asyncio
async def test_invalid_oauth_state_never_exchanges_code(auth_app, monkeypatch):
    for name in ("anilist_client_id", "anilist_client_secret", "anilist_redirect_uri"):
        monkeypatch.setattr(auth.settings, name, "synthetic-only")
    class Manager:
        async def consume_state(self, state):
            return None
    async def manager():
        return Manager()
    async def forbidden(**kwargs):
        raise AssertionError("Invalid state must never send a code upstream")
    monkeypatch.setattr(auth, "get_session_manager", manager)
    monkeypatch.setattr(auth.anilist, "exchange_code_for_token", forbidden)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app), base_url="http://test") as client:
        assert (await client.get("/auth/anilist/callback", params={"code": "synthetic", "state": "expired"})).status_code == 400
        assert (await client.post("/auth/anilist/refresh")).status_code == 401


@pytest.mark.asyncio
async def test_session_backend_failure_is_not_logged_out_success(auth_app, monkeypatch):
    class Manager:
        async def get_session(self, cookie):
            raise RuntimeError("synthetic backend unavailable")
        async def revoke_session(self, cookie):
            raise RuntimeError("synthetic backend unavailable")
    async def manager():
        return Manager()
    monkeypatch.setattr(auth, "get_session_manager", manager)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app, raise_app_exceptions=False), base_url="http://test", cookies={"guesssenpai_session": "synthetic"}) as client:
        assert (await client.get("/auth/anilist/me")).status_code == 500
        response = await client.post("/auth/anilist/logout")
        assert response.status_code == 500
        assert "set-cookie" not in response.headers

