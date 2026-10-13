from types import SimpleNamespace

import httpx
import pytest
from fastapi import FastAPI

from app.routers import auth
from app.services import anilist


@pytest.fixture
def callback_setup(monkeypatch):
    app = FastAPI()
    app.include_router(auth.router)
    for name in ("anilist_client_id", "anilist_client_secret"):
        monkeypatch.setattr(auth.settings, name, "synthetic-only")
    monkeypatch.setattr(auth.settings, "anilist_redirect_uri", "https://example.test/api/auth/anilist/callback")
    monkeypatch.setattr(auth.settings, "frontend_base_url", "https://example.test")
    monkeypatch.setattr(auth.settings, "session_cookie_secure", True)
    issued = []

    class Manager:
        async def consume_state(self, state):
            return SimpleNamespace(redirect_to=None)

        async def issue_session(self, session):
            issued.append(session)
            return "synthetic-session"

    async def manager():
        return Manager()

    async def exchange(**kwargs):
        # This is AniList's actual response shape: no user object.
        return anilist.TokenResponse(token_type="Bearer", access_token="synthetic-token", expires_in=3600)

    monkeypatch.setattr(auth, "get_session_manager", manager)
    monkeypatch.setattr(anilist, "exchange_code_for_token", exchange)
    return app, issued


@pytest.mark.asyncio
async def test_token_only_response_resolves_viewer_before_creating_session(callback_setup, monkeypatch):
    app, issued = callback_setup

    async def request(query, variables, token=None):
        assert "Viewer" in query
        assert variables == {}
        assert token == "synthetic-token"
        return {"Viewer": {"id": 123, "name": "TestViewer", "avatar": {"large": "https://example.test/avatar.png"}}}

    monkeypatch.setattr(anilist, "gql_request", request)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="https://example.test") as client:
        response = await client.get("/auth/anilist/callback", params={"code": "synthetic", "state": "synthetic"})
    assert response.status_code == 307
    assert response.headers["location"] == "https://example.test"
    assert "Secure" in response.headers["set-cookie"]
    assert "HttpOnly" in response.headers["set-cookie"]
    assert issued[0].user_id == 123
    assert issued[0].username == "TestViewer"
    assert issued[0].avatar == "https://example.test/avatar.png"
    assert issued[0].access_token == "synthetic-token"


@pytest.mark.asyncio
@pytest.mark.parametrize("failure", ["missing", "upstream"])
async def test_viewer_failure_never_creates_a_session(callback_setup, monkeypatch, failure):
    app, issued = callback_setup

    async def request(query, variables, token=None):
        if failure == "upstream":
            raise anilist.AniListError("synthetic upstream failure")
        return {"Viewer": None}

    monkeypatch.setattr(anilist, "gql_request", request)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="https://example.test") as client:
        response = await client.get("/auth/anilist/callback", params={"code": "synthetic", "state": "synthetic"})
    assert response.status_code == 502
    assert "set-cookie" not in response.headers
    assert not issued
    assert "synthetic-token" not in response.text
