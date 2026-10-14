"""Explicit opt-in public network smoke; local database is the test SQLite fixture."""
import os

import httpx
import pytest
from fastapi import FastAPI

from app.routers import puzzles
from app.services import anilist
from app.services import animethemes


@pytest.mark.skipif(os.environ.get("RUN_PUBLIC_UPSTREAM_SMOKE") != "1", reason="explicit public-network smoke opt-in")
@pytest.mark.asyncio
async def test_public_second_season_opening_matches_anilist_identity():
    media = await anilist.fetch_media_details(20958)
    clip = await animethemes.find_opening_clip([media.title.romaji, media.title.english], anilist_id=media.id)
    assert clip is not None
    assert clip.video_url or clip.audio_url


@pytest.mark.skipif(os.environ.get("RUN_PUBLIC_UPSTREAM_SMOKE") != "1", reason="explicit public-network smoke opt-in")
@pytest.mark.asyncio
async def test_public_full_pool_page_and_batch_details_agree():
    # Two public reads verify the actual query complexity and response shape.
    pool = await anilist.fetch_popular_pool(pages=1)
    assert len(pool) == anilist.MAX_PER_PAGE
    ids = [pool[0].id, pool[-1].id]
    details = await anilist.fetch_media_details_batch(ids)
    assert set(details) == set(ids)
    for media in (pool[0], pool[-1]):
        # Live counters can change between requests; tied tag ranks can also
        # arrive in a different order even though the metadata is equivalent.
        pool_record = media.model_dump(exclude={"popularity", "averageScore"})
        batch_record = details[media.id].model_dump(exclude={"popularity", "averageScore"})
        for record in (pool_record, batch_record):
            record["tags"] = sorted(record["tags"], key=lambda tag: tag["name"])
        assert pool_record == batch_record


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
