from copy import deepcopy
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.core.database import get_session_factory
from app.db.models import DailyPuzzleSet
from app.puzzles import engine
from app.puzzles.models import DailyProgressPayload, GameProgressPayload
from app.services import progress
from test_puzzles_engine import DummyCache, make_character_silhouette, make_media


@pytest.fixture
def local_generation(monkeypatch):
    pool = [make_media(2000 + i, f"Fixture {i}") for i in range(12)]

    async def popular(*args):
        return pool

    async def details(media_id, *args):
        return next(media for media in pool if media.id == media_id)

    async def cache():
        return DummyCache()

    monkeypatch.setattr(engine, "_load_popular_pool", popular)
    monkeypatch.setattr(engine, "_load_media_details", details)
    monkeypatch.setattr(engine, "_get_cache", cache)
    monkeypatch.setattr(engine, "_build_character_guess_game", make_character_silhouette)
    return pool


@pytest.mark.asyncio
async def test_published_daily_is_shared_and_survives_upstream_change(local_generation, monkeypatch):
    day = datetime.now(timezone.utc).date()
    first = await engine.get_daily_puzzle(day)

    async def must_not_generate(*args, **kwargs):
        raise AssertionError("Published content must never regenerate")

    monkeypatch.setattr(engine, "_assemble_daily_puzzle", must_not_generate)
    for user_id in (71, 72):
        user = engine.UserContext(user_id=user_id, username="test", access_token="unused")
        other = await engine.get_daily_puzzle(day, user=user, include_guess_opening=True)
        assert other.model_dump(mode="json") == first.model_dump(mode="json")
    async with get_session_factory()() as session:
        assert len((await session.scalars(select(DailyPuzzleSet))).all()) == 1


@pytest.mark.asyncio
async def test_legacy_published_anidle_keeps_rules_and_raw_snapshot(local_generation, monkeypatch):
    day = datetime.now(timezone.utc).date()
    await engine.get_daily_puzzle(day)
    async with get_session_factory()() as session:
        row = (await session.scalars(select(DailyPuzzleSet))).one()
        content = deepcopy(row.content)
        content["games"]["anidle"]["puzzle"].pop("rules", None)
        content["games"]["anidle"]["puzzle"]["spec"] = [spec.model_dump() for spec in engine.ANIDLE_ROUNDS]
        row.content = content
        row.rules_version = "1"
        await session.commit()

    async def must_not_generate(*args, **kwargs):
        raise AssertionError("Never upgrade a published snapshot")

    monkeypatch.setattr(engine, "_assemble_daily_puzzle", must_not_generate)
    legacy = await engine.get_daily_puzzle(day)
    assert legacy.rules_version == "1"
    assert legacy.games.anidle.puzzle.rules is None
    assert len(legacy.games.anidle.puzzle.spec) == 3
    async with get_session_factory()() as session:
        row = (await session.scalars(select(DailyPuzzleSet))).one()
        assert row.rules_version == "1"
        assert "rules" not in row.content["games"]["anidle"]["puzzle"]


@pytest.mark.asyncio
async def test_unpublished_past_and_future_are_not_generated(local_generation):
    today = datetime.now(timezone.utc).date()
    with pytest.raises(LookupError):
        await engine.get_daily_puzzle(today - timedelta(days=1))
    with pytest.raises(ValueError):
        await engine.get_daily_puzzle(today + timedelta(days=1))


@pytest.mark.asyncio
async def test_legacy_history_survives_shared_write_and_stale_update(local_generation):
    day = datetime.now(timezone.utc).date()
    user_id = 33
    legacy = DailyProgressPayload(date=day, progress={"anidle": GameProgressPayload(guesses=["personalized"] )})
    await progress.store_daily_progress(user_id, legacy)
    shared = DailyProgressPayload(date=day, puzzle_id=f"daily:{day}", rules_version="1",
        progress={"anidle": GameProgressPayload(completed=True, round=3, guesses=["shared"])})
    assert (await progress.load_daily_progress(user_id, day, shared.puzzle_id, "1")).progress == {}
    await progress.merge_daily_progress(user_id, shared)
    stale = shared.model_copy(update={"progress": {"anidle": GameProgressPayload(round=1)}})
    await progress.merge_daily_progress(user_id, stale)
    await progress.merge_daily_progress(user_id, legacy)
    loaded = await progress.load_daily_progress(user_id, day, shared.puzzle_id, "1")
    assert loaded.progress["anidle"].completed
    assert loaded.progress["anidle"].guesses == ["shared"]
    from app.db.models import DailyProgress
    async with get_session_factory()() as session:
        row = await session.get(DailyProgress, (user_id, day))
        assert row.progress["_legacy_history"]["anidle"]["guesses"] == ["personalized"]


@pytest.mark.asyncio
async def test_wrong_account_cannot_write_progress(monkeypatch):
    from types import SimpleNamespace
    from fastapi import HTTPException
    from starlette.requests import Request
    from app.routers import puzzles

    async def session(_request):
        return SimpleNamespace(user_id=2)

    monkeypatch.setattr(puzzles, "_optional_session", session)
    with pytest.raises(HTTPException) as failure:
        await puzzles.put_progress(Request({"type": "http", "headers": []}),
            DailyProgressPayload(date=datetime.now(timezone.utc).date(), account_user_id=1))
    assert failure.value.status_code == 409
