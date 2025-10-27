from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from ..core.config import settings
from ..services.cache import get_cache

PREFERENCE_KEY_TEMPLATE = "guesssenpai:user-preferences:{user_id}"

MIN_DIFFICULTY_LEVEL = 1
MAX_DIFFICULTY_LEVEL = 3


class UserPreferences(BaseModel):
    """Serialized preference payload for a GuessSenpai user."""

    difficulty_level: Optional[int] = Field(default=None)

    @model_validator(mode="before")
    @classmethod
    def _migrate_legacy_payload(cls, value: Any) -> Any:
        if not isinstance(value, dict):
            return value
        if "difficulty_level" in value:
            return value
        if "difficulty" not in value:
            return value
        migrated = dict(value)
        migrated["difficulty_level"] = cls._coerce_difficulty(value["difficulty"])
        return migrated

    @field_validator("difficulty_level", mode="before")
    @classmethod
    def _coerce_difficulty(cls, value: object) -> Optional[int]:
        if value is None:
            return None
        if isinstance(value, dict):
            candidates: list[int] = []
            for raw in value.values():
                try:
                    candidates.append(int(raw))
                except (TypeError, ValueError):
                    continue
            if not candidates:
                return None
            value = max(candidates)
        try:
            coerced = int(value)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            return None
        return max(MIN_DIFFICULTY_LEVEL, min(MAX_DIFFICULTY_LEVEL, coerced))


async def load_user_preferences(user_id: int) -> UserPreferences:
    """Fetch user preferences from the cache backend."""

    cache = await get_cache(settings.redis_url)
    key = PREFERENCE_KEY_TEMPLATE.format(user_id=user_id)
    raw = await cache.get(key)
    if raw is None:
        return UserPreferences()
    try:
        return UserPreferences.model_validate(raw)
    except Exception:
        return UserPreferences()


async def update_user_preferences(
    user_id: int, update: UserPreferences
) -> UserPreferences:
    """Merge and persist the provided preference update."""

    cache = await get_cache(settings.redis_url)
    key = PREFERENCE_KEY_TEMPLATE.format(user_id=user_id)
    existing = await load_user_preferences(user_id)
    base_data = existing.model_dump()
    if "difficulty_level" in update.model_fields_set:
        base_data["difficulty_level"] = update.difficulty_level
    merged = UserPreferences(**base_data)
    await cache.set(key, merged.model_dump(mode="json"))
    return merged
