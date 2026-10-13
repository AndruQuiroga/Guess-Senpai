"""Explicit opt-in public network smoke; local database is the test SQLite fixture."""
import os

import httpx
import pytest
from fastapi import FastAPI

from app.routers import puzzles


@pytest.mark.skipif(os.environ.get("RUN_PUBLIC_UPSTREAM_SMOKE") != "1", reason="explicit public-network smoke opt-in")
@pytest.mark.asyncio
async def test_public_title_search_evaluation_and_processed_poster(monkeypatch):
    # Neither the ignored root .env nor a user database/account is used.
    monkeypatch.setattr(puzzles.settings, "redis_url", None)
    app = FastAPI()
    app.include_router(puzzles.router, prefix="/puzzles")
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/puzzles/search-titles", params={"q": "Cowboy Bebop", "limit": 3})
        assert response.status_code == 200, response.text
        matches = response.json()["results"]
        assert any(item["id"] == 1 for item in matches)
        evaluation = await client.post("/puzzles/anidle/evaluate", json={"puzzle_media_id": 1, "guess_media_id": 1, "guess": "Cowboy Bebop"})
        assert evaluation.status_code == 200, evaluation.text
        assert evaluation.json()["correct"] is True
        poster = await client.get("/puzzles/poster/1/image", params={"hints": 0})
        assert poster.status_code == 200, poster.text
        assert poster.headers["content-type"].startswith("image/")
        assert len(poster.content) > 100
