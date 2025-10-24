from __future__ import annotations

import asyncio
from datetime import date, timedelta

from app.puzzles.models import DailyProgressPayload, GameProgressPayload, StreakPayload
from app.services import progress

def test_daily_progress_persistence_and_merge() -> None:
    user_id = 101
    day = date(2024, 11, 1)

    async def _scenario() -> None:
        empty = await progress.load_daily_progress(user_id, day)
        assert empty.date == day
        assert empty.progress == {}

        first = DailyProgressPayload(
            date=day,
            progress={
                "anidle": GameProgressPayload(completed=True, round=3, guesses=["foo"]),
            },
        )
        await progress.store_daily_progress(user_id, first)

        stored = await progress.load_daily_progress(user_id, day)
        assert stored.progress["anidle"].completed is True
        assert stored.progress["anidle"].round == 3

        second = DailyProgressPayload(
            date=day,
            progress={
                "poster": GameProgressPayload(completed=False, round=1, guesses=["bar"]),
            },
        )
        await progress.merge_daily_progress(user_id, second)

        merged = await progress.load_daily_progress(user_id, day)
        assert merged.progress["anidle"].completed is True
        assert merged.progress["poster"].round == 1

        overwrite = DailyProgressPayload(
            date=day,
            progress={
                "anidle": GameProgressPayload(completed=False, round=2, guesses=["baz"]),
            },
        )
        await progress.merge_daily_progress(user_id, overwrite)

        overwritten = await progress.load_daily_progress(user_id, day)
        assert overwritten.progress["anidle"].completed is False
        assert overwritten.progress["anidle"].round == 2
        assert overwritten.progress["poster"].round == 1

    asyncio.run(_scenario())


def test_progress_history_and_aggregate_window(monkeypatch) -> None:
    user_id = 202
    start_day = date(2024, 10, 30)
    history_days = 2
    monkeypatch.setattr(progress.settings, "puzzle_history_days", history_days)

    def _payload_for(offset: int, games: dict[str, tuple[bool, int]]) -> DailyProgressPayload:
        current_day = start_day + timedelta(days=offset)
        progress_map = {
            name: GameProgressPayload(completed=completed, round=round_idx)
            for name, (completed, round_idx) in games.items()
        }
        return DailyProgressPayload(date=current_day, progress=progress_map)

    async def _scenario() -> None:
        await progress.store_daily_progress(
            user_id,
            _payload_for(0, {"anidle": (True, 3)}),
        )
        await progress.store_daily_progress(
            user_id,
            _payload_for(1, {"anidle": (True, 2), "poster": (False, 1)}),
        )
        await progress.store_daily_progress(
            user_id,
            _payload_for(2, {"redacted": (True, 1)}),
        )

        history = await progress.load_progress_history(user_id)
        assert len(history) == history_days
        assert history[0].date == start_day + timedelta(days=2)
        assert history[0].completed == 1
        assert history[0].total == 1
        assert history[1].date == start_day + timedelta(days=1)
        assert history[1].completed == 1
        assert history[1].total == 2

        aggregate = await progress.load_progress_aggregate(user_id)
        assert aggregate.total_games == 3
        assert aggregate.completed_games == 2
        assert aggregate.active_days == history_days

    asyncio.run(_scenario())


def test_streak_persistence() -> None:
    user_id = 303

    async def _scenario() -> None:
        default = await progress.load_streak(user_id)
        assert default.count == 0
        assert default.last_completed is None

        first = StreakPayload(count=3, last_completed=date(2024, 10, 31))
        await progress.store_streak(user_id, first)

        stored = await progress.load_streak(user_id)
        assert stored.count == 3
        assert stored.last_completed == date(2024, 10, 31)

        updated = StreakPayload(count=5, last_completed=date(2024, 11, 2))
        await progress.store_streak(user_id, updated)

        persisted = await progress.load_streak(user_id)
        assert persisted.count == 5
        assert persisted.last_completed == date(2024, 11, 2)

    asyncio.run(_scenario())
