from __future__ import annotations

from datetime import date
from typing import Any, Dict, List

from ..core.config import settings
from ..core.database import get_session_factory
from ..puzzles.models import (
    DailyProgressPayload,
    GameProgressPayload,
    ProgressAggregate,
    ProgressHistoryEntry,
    StreakPayload,
)
from .progress_repository import (
    get_daily_progress as repo_get_daily_progress,
    get_streak as repo_get_streak,
    list_daily_progress as repo_list_daily_progress,
    upsert_daily_progress as repo_upsert_daily_progress,
    upsert_streak as repo_upsert_streak,
)


def _deserialize_progress(raw: Any) -> Dict[str, GameProgressPayload]:
    progress: Dict[str, GameProgressPayload] = {}
    if not isinstance(raw, dict):
        return progress
    for key, value in raw.items():
        if not isinstance(value, dict):
            continue
        try:
            progress[key] = GameProgressPayload.model_validate(value)
            continue
        except Exception:
            pass

        if isinstance(value, GameProgressPayload):
            progress[key] = value
            continue

        fallback_payload: Dict[str, Any] = {}
        if isinstance(value, dict):
            if "completed" in value:
                fallback_payload["completed"] = value.get("completed")
            if "round" in value:
                fallback_payload["round"] = value.get("round")
            if "guesses" in value:
                fallback_payload["guesses"] = value.get("guesses")
            if "rounds" in value:
                fallback_payload["rounds"] = value.get("rounds")
            else:
                for legacy_key in ("round_progress", "rounds_progress"):
                    if legacy_key in value:
                        fallback_payload["rounds"] = value.get(legacy_key)
                        break
        try:
            progress[key] = GameProgressPayload.model_validate(fallback_payload)
        except Exception:
            continue
    return progress


def _summarize_payload(payload: DailyProgressPayload) -> ProgressHistoryEntry:
    total = len(payload.progress)
    completed = sum(1 for progress in payload.progress.values() if progress.completed)
    return ProgressHistoryEntry(date=payload.date, completed=completed, total=total)


async def load_daily_progress(user_id: int, day: date) -> DailyProgressPayload:
    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            record = await repo_get_daily_progress(session, user_id, day)
            await session.commit()
        except Exception:
            await session.rollback()
            raise
    progress = _deserialize_progress(record.progress if record else {})
    return DailyProgressPayload(date=day, progress=progress)


async def store_daily_progress(user_id: int, payload: DailyProgressPayload) -> DailyProgressPayload:
    serializable: Dict[str, Dict[str, Any]] = {}
    for key, value in payload.progress.items():
        if isinstance(value, GameProgressPayload):
            serializable[key] = value.model_dump(
                mode="json", by_alias=True, exclude_none=True
            )
        else:
            validated = GameProgressPayload.model_validate(value)
            serializable[key] = validated.model_dump(
                mode="json", by_alias=True, exclude_none=True
            )
    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            await repo_upsert_daily_progress(session, user_id, payload.date, serializable)
            await session.commit()
        except Exception:
            await session.rollback()
            raise
    return payload


async def merge_daily_progress(user_id: int, payload: DailyProgressPayload) -> DailyProgressPayload:
    existing = await load_daily_progress(user_id, payload.date)
    merged = {**existing.progress, **payload.progress}
    merged_payload = DailyProgressPayload(date=payload.date, progress=merged)
    return await store_daily_progress(user_id, merged_payload)


async def load_streak(user_id: int) -> StreakPayload:
    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            record = await repo_get_streak(session, user_id)
            await session.commit()
        except Exception:
            await session.rollback()
            raise
    if record is None:
        return StreakPayload()
    return StreakPayload(count=record.count, last_completed=record.last_completed)


async def store_streak(user_id: int, payload: StreakPayload) -> StreakPayload:
    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            await repo_upsert_streak(session, user_id, payload.count, payload.last_completed)
            await session.commit()
        except Exception:
            await session.rollback()
            raise
    return payload


async def load_progress_history(user_id: int) -> List[ProgressHistoryEntry]:
    window = max(settings.puzzle_history_days, 0)
    limit = window if window > 0 else None
    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            records = await repo_list_daily_progress(session, user_id, limit=limit, descending=True)
            await session.commit()
        except Exception:
            await session.rollback()
            raise
    entries: List[ProgressHistoryEntry] = []
    for record in records:
        payload = DailyProgressPayload(
            date=record.puzzle_date,
            progress=_deserialize_progress(record.progress),
        )
        entries.append(_summarize_payload(payload))
    entries.sort(key=lambda item: item.date, reverse=True)
    return entries


async def load_progress_aggregate(user_id: int) -> ProgressAggregate:
    history = await load_progress_history(user_id)
    total_games = sum(max(entry.total, 0) for entry in history)
    completed_games = sum(max(min(entry.completed, entry.total), 0) for entry in history)
    active_days = sum(1 for entry in history if entry.total > 0)
    return ProgressAggregate(
        total_games=total_games,
        completed_games=completed_games,
        active_days=active_days,
    )
