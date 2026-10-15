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
    assert response.mode_puzzle_ids["anidle"].endswith(f":v{engine.CURRENT_RULES_VERSION}")


@pytest.mark.asyncio
async def test_republish_regenerates_round_content_from_an_older_version(local_generation, monkeypatch):  # noqa: F811
    today = datetime.now(timezone.utc).date()
    day = today - timedelta(days=1)
    await engine.publish_daily_puzzle(day)
    async with get_session_factory()() as session:
        row = await session.get(DailyPuzzleSet, day)
        row.rules_version = "3"
        row.content = {**row.content, "marker": "rules-v3"}
        await session.commit()

    calls = []
    assemble = engine._assemble_daily_puzzle

    async def counting(*args, **kwargs):
        calls.append(1)
        return await assemble(*args, **kwargs)

    monkeypatch.setattr(engine, "_assemble_daily_puzzle", counting)
    upgraded = await engine.publish_daily_puzzle(day, replace_legacy=True)
    # Same-format content is rebuilt too: the rules changed, not just the label.
    assert calls == [1]
    assert upgraded.rules_version == engine.CURRENT_RULES_VERSION
    async with get_session_factory()() as session:
        assert "marker" not in (await session.get(DailyPuzzleSet, day)).content


@pytest.mark.asyncio
async def test_reseed_replaces_a_current_set_with_a_differently_seeded_one(local_generation, monkeypatch):  # noqa: F811
    today = datetime.now(timezone.utc).date()
    await engine.publish_daily_puzzle(today)
    seeds = []
    assemble = engine._assemble_daily_puzzle

    async def recording(*args, **kwargs):
        seeds.append(kwargs.get("seed_salt"))
        return await assemble(*args, **kwargs)

    monkeypatch.setattr(engine, "_assemble_daily_puzzle", recording)
    # A plain publish keeps the current set; a reseed regenerates it.
    await engine.publish_daily_puzzle(today)
    assert seeds == []
    await backfill.reseed(today, "again")
    assert seeds == ["again"]
    async with get_session_factory()() as session:
        row = await session.get(DailyPuzzleSet, today)
        assert row.rules_version == engine.CURRENT_RULES_VERSION


async def _used_ids(day):
    media_ids: set[int] = set()
    character_ids: set[int] = set()
    async with get_session_factory()() as session:
        row = await session.get(DailyPuzzleSet, day)
    engine._collect_used_ids(row.content, media_ids, character_ids)
    return media_ids, character_ids


@pytest.mark.asyncio
async def test_nearby_days_do_not_repeat_anime_or_characters(local_generation):  # noqa: F811
    from test_puzzles_engine import _media_with_character

    local_generation.extend(_media_with_character(3000 + i, f"Extra {i}", 900 - i) for i in range(120))
    today = datetime.now(timezone.utc).date()
    await backfill.backfill(3, today=today, pause_seconds=0, retry_wait_seconds=0)

    days = [today - timedelta(days=offset) for offset in (3, 2, 1)]
    used = [await _used_ids(day) for day in days]
    for index, (media_ids, character_ids) in enumerate(used):
        assert media_ids and character_ids
        for other_media, other_characters in used[index + 1 :]:
            assert not media_ids & other_media
            assert not character_ids & other_characters


@pytest.mark.asyncio
async def test_small_pool_still_publishes_nearby_days_by_reusing_anime(local_generation):  # noqa: F811
    # 48 anime cannot fill two fresh days; freshness yields instead of failing.
    today = datetime.now(timezone.utc).date()
    published = await backfill.backfill(2, today=today, pause_seconds=0, retry_wait_seconds=0)
    assert len(published) == 2


def test_tier_candidates_prefer_anime_not_used_recently() -> None:
    from test_puzzles_engine import make_media

    pool = [make_media(i, f"Show {i}") for i in range(6)]
    tiers = engine._popularity_tiers(pool)
    easy = tiers[1]
    fresh = engine._tier_candidates(pool, tiers, 1, set(), avoid_ids=easy)
    assert {media.id for media in fresh}.isdisjoint(easy)
    # With everything recent, the round still draws from its own tier.
    everything = {media.id for media in pool}
    fallback = engine._tier_candidates(pool, tiers, 1, set(), avoid_ids=everything)
    assert {media.id for media in fallback} == easy


@pytest.mark.asyncio
async def test_reseed_gives_the_day_a_new_identity_so_progress_resets(local_generation):  # noqa: F811
    from app.puzzles.models import DailyProgressPayload
    from app.services.progress import load_daily_progress, merge_daily_progress
    from app.db.models import User

    today = datetime.now(timezone.utc).date()
    original = await engine.publish_daily_puzzle(today)
    assert original.puzzle_id == f"daily:{today.isoformat()}"
    async with get_session_factory()() as session:
        session.add(User(id=77, username="player", access_token="t", access_token_expires_at=datetime.now(timezone.utc)))
        await session.commit()
    await merge_daily_progress(
        77,
        DailyProgressPayload(
            date=today,
            puzzle_id=original.puzzle_id,
            rules_version=original.rules_version,
            progress={"anidle": {"completed": True, "guesses": ["X"], "round": 1}},
        ),
    )

    await backfill.reseed(today, "fresh")
    reseeded = await engine.get_daily_puzzle(today)
    assert reseeded.puzzle_id == f"daily:{today.isoformat()}:fresh"
    assert all(pid.startswith(reseeded.puzzle_id + ":") for pid in reseeded.mode_puzzle_ids.values())
    # Progress saved against the replaced set does not attach to the new one.
    stale = await load_daily_progress(77, today, reseeded.puzzle_id, reseeded.rules_version)
    assert stale.progress == {}
