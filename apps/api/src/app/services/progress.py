from __future__ import annotations

from datetime import date
from typing import Dict

from ..core.config import settings
from ..puzzles.models import DailyProgressPayload, GameProgressPayload, StreakPayload
from .cache import CacheBackend, get_cache

PROGRESS_KEY_PREFIX = "guesssenpai:puzzle:progress"
STREAK_KEY_PREFIX = "guesssenpai:puzzle:streak"


async def _get_cache() -> CacheBackend:
    return await get_cache(settings.redis_url)


def _progress_key(user_id: int, day: date) -> str:
    return f"{PROGRESS_KEY_PREFIX}:{user_id}:{day.isoformat()}"


def _streak_key(user_id: int) -> str:
    return f"{STREAK_KEY_PREFIX}:{user_id}"


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
