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


@pytest.mark.asyncio
async def test_republish_legacy_upgrades_old_sets_only(local_generation):  # noqa: F811
    today = datetime.now(timezone.utc).date()
    current_day = today - timedelta(days=1)
    current = await engine.publish_daily_puzzle(current_day)
    assert current.rules_version == engine.CURRENT_RULES_VERSION

    # A set stored by the old format, today included.
    await engine.publish_daily_puzzle(today)
    async with get_session_factory()() as session:
        row = await session.get(DailyPuzzleSet, today)
        row.rules_version = "2"
        # Old format: a single synopsis without rounds.
        games = dict(row.content["games"])
        games["redacted_synopsis"] = {
            **games["redacted_synopsis"],
            "puzzle": {**games["redacted_synopsis"]["puzzle"], "rounds": []},
        }
        row.content = {**row.content, "games": games, "marker": "legacy"}
        await session.commit()

    assert await backfill.missing_days(1, today=today) == []
    assert await backfill.missing_days(1, today=today, include_legacy=True) == [today]

    published = await backfill.backfill(
        1, today=today, pause_seconds=0, retry_wait_seconds=0, republish_legacy=True
    )
    assert published == [today]
    async with get_session_factory()() as session:
        upgraded = await session.get(DailyPuzzleSet, today)
        assert upgraded.rules_version == engine.CURRENT_RULES_VERSION
        assert "marker" not in upgraded.content
    # The current-format day was not regenerated.
    again = await engine.get_daily_puzzle(current_day)
    assert again.model_dump() == current.model_dump()
    response = await engine.get_daily_puzzle(today)
    assert response.mode_puzzle_ids["anidle"].endswith(":v3")


@pytest.mark.asyncio
async def test_republish_relabels_round_content_without_regenerating(local_generation, monkeypatch):  # noqa: F811
    today = datetime.now(timezone.utc).date()
    day = today - timedelta(days=1)
    original = await engine.publish_daily_puzzle(day)
    async with get_session_factory()() as session:
        row = await session.get(DailyPuzzleSet, day)
        row.rules_version = "2"
        await session.commit()

    async def must_not_generate(*args, **kwargs):
        raise AssertionError("round-format content must not be regenerated")

    monkeypatch.setattr(engine, "_assemble_daily_puzzle", must_not_generate)
    upgraded = await engine.publish_daily_puzzle(day, replace_legacy=True)
    assert upgraded.rules_version == engine.CURRENT_RULES_VERSION
    assert upgraded.games.model_dump() == original.games.model_dump()
