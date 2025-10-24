from __future__ import annotations

from datetime import date
from typing import Any, Dict, List

from ..core.config import settings
from ..puzzles.models import (
    DailyProgressPayload,
    GameProgressPayload,
    ProgressAggregate,
    ProgressHistoryEntry,
    StreakPayload,
)
from .cache import CacheBackend, get_cache

PROGRESS_KEY_PREFIX = "guesssenpai:puzzle:progress"
STREAK_KEY_PREFIX = "guesssenpai:puzzle:streak"
PROGRESS_HISTORY_KEY_PREFIX = "guesssenpai:puzzle:progress-history"


async def _get_cache() -> CacheBackend:
    return await get_cache(settings.redis_url)


def _progress_key(user_id: int, day: date) -> str:
    return f"{PROGRESS_KEY_PREFIX}:{user_id}:{day.isoformat()}"


def _streak_key(user_id: int) -> str:
    return f"{STREAK_KEY_PREFIX}:{user_id}"


def _progress_history_key(user_id: int) -> str:
    return f"{PROGRESS_HISTORY_KEY_PREFIX}:{user_id}"


def _deserialize_history(raw: Any) -> List[ProgressHistoryEntry]:
    entries: List[ProgressHistoryEntry] = []
    if isinstance(raw, list):
        for item in raw:
            try:
                entries.append(ProgressHistoryEntry.model_validate(item))
            except Exception:
                continue
        return entries

    if isinstance(raw, dict):
        for key, value in raw.items():
            if not isinstance(value, dict):
                continue
            try:
                day = date.fromisoformat(str(key))
            except ValueError:
                continue
            completed_raw = value.get("completed", 0)
            total_raw = value.get("total", 0)
            try:
                completed = int(completed_raw)
                total = int(total_raw)
            except (TypeError, ValueError):
                continue
            entries.append(ProgressHistoryEntry(date=day, completed=completed, total=total))
    return entries


async def load_daily_progress(user_id: int, day: date) -> DailyProgressPayload:
    cache = await _get_cache()
    raw = await cache.get(_progress_key(user_id, day))
    progress: Dict[str, GameProgressPayload] = {}
    if isinstance(raw, dict):
        for key, value in raw.items():
            try:
                progress[key] = GameProgressPayload.model_validate(value)
            except Exception:
                continue
    return DailyProgressPayload(date=day, progress=progress)


async def store_daily_progress(user_id: int, payload: DailyProgressPayload) -> DailyProgressPayload:
    cache = await _get_cache()
    key = _progress_key(user_id, payload.date)
    serializable = {k: v.model_dump(mode="json") for k, v in payload.progress.items()}
    await cache.set(key, serializable)
    await _record_progress_history(user_id, _summarize_payload(payload), cache)
    return payload


async def merge_daily_progress(user_id: int, payload: DailyProgressPayload) -> DailyProgressPayload:
    existing = await load_daily_progress(user_id, payload.date)
    merged = {**existing.progress, **payload.progress}
    merged_payload = DailyProgressPayload(date=payload.date, progress=merged)
    return await store_daily_progress(user_id, merged_payload)


async def load_streak(user_id: int) -> StreakPayload:
    cache = await _get_cache()
    raw = await cache.get(_streak_key(user_id))
    if isinstance(raw, dict):
        try:
            return StreakPayload.model_validate(raw)
        except Exception:
            pass
    return StreakPayload()


async def store_streak(user_id: int, payload: StreakPayload) -> StreakPayload:
    cache = await _get_cache()
    await cache.set(_streak_key(user_id), payload.model_dump(mode="json"))
    return payload


def _summarize_payload(payload: DailyProgressPayload) -> ProgressHistoryEntry:
    total = len(payload.progress)
    completed = sum(1 for progress in payload.progress.values() if progress.completed)
    return ProgressHistoryEntry(date=payload.date, completed=completed, total=total)


async def _record_progress_history(
    user_id: int,
    entry: ProgressHistoryEntry,
    cache: CacheBackend | None = None,
) -> None:
    cache_backend = cache or await _get_cache()
    raw_history = await cache_backend.get(_progress_history_key(user_id))
    entries = _deserialize_history(raw_history)
    history_by_date: Dict[date, ProgressHistoryEntry] = {item.date: item for item in entries}
    history_by_date[entry.date] = entry
    ordered = sorted(history_by_date.values(), key=lambda item: item.date, reverse=True)
    window = max(settings.puzzle_history_days, 0)
    if window:
        ordered = ordered[:window]
    payload = [item.model_dump(mode="json") for item in ordered]
    await cache_backend.set(
        _progress_history_key(user_id),
        payload,
        settings.puzzle_cache_ttl_seconds,
    )


async def load_progress_history(user_id: int) -> List[ProgressHistoryEntry]:
    cache = await _get_cache()
    raw = await cache.get(_progress_history_key(user_id))
    entries = _deserialize_history(raw)
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
