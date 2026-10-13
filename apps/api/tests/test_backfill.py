from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.core.database import get_session_factory
from app.db.models import DailyPuzzleSet
from app.puzzles import backfill, engine
from test_daily_snapshots import local_generation  # noqa: F401  (fixture)


@pytest.mark.asyncio
async def test_backfill_publishes_only_missing_past_days(local_generation):  # noqa: F811
    today = datetime.now(timezone.utc).date()
    existing_day = today - timedelta(days=2)
    existing = await engine.publish_daily_puzzle(existing_day)

    published = await backfill.backfill(3, today=today, pause_seconds=0, retry_wait_seconds=0)

    # Days 3 and 1 back are filled; day 2 already existed; today is skipped.
    assert published == [today - timedelta(days=3), today - timedelta(days=1)]
    async with get_session_factory()() as session:
        for offset in (1, 2, 3):
            assert await session.get(DailyPuzzleSet, today - timedelta(days=offset)) is not None
        assert await session.get(DailyPuzzleSet, today) is None

    # The existing set is untouched and past days now load from the archive.
    again = await engine.get_daily_puzzle(existing_day)
    assert again.model_dump() == existing.model_dump()
    assert await backfill.missing_days(3, today=today) == []


@pytest.mark.asyncio
async def test_publish_refuses_future_days(local_generation):  # noqa: F811
    tomorrow = datetime.now(timezone.utc).date() + timedelta(days=1)
    with pytest.raises(ValueError):
        await engine.publish_daily_puzzle(tomorrow)


@pytest.mark.asyncio
async def test_backfill_retries_a_rate_limited_day(local_generation, monkeypatch):  # noqa: F811
    today = datetime.now(timezone.utc).date()
    real_publish = engine.publish_daily_puzzle
    calls = {"count": 0}

    async def flaky_publish(day, **kwargs):
        calls["count"] += 1
        if calls["count"] == 1:
            raise RuntimeError("429 Too Many Requests")
        return await real_publish(day, **kwargs)

    monkeypatch.setattr(engine, "publish_daily_puzzle", flaky_publish)
    published = await backfill.backfill(1, today=today, pause_seconds=0, retry_wait_seconds=0)
    assert published == [today - timedelta(days=1)]
    assert calls["count"] == 2
