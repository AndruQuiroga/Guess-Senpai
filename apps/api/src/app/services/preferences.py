from __future__ import annotations

from typing import Dict

from pydantic import BaseModel, Field, field_validator

from ..core.config import settings
from ..services.cache import get_cache

PREFERENCE_KEY_TEMPLATE = "guesssenpai:user-preferences:{user_id}"


class UserPreferences(BaseModel):
    """Serialized preference payload for a GuessSenpai user."""

    difficulty: Dict[str, int] = Field(default_factory=dict)

    @field_validator("difficulty", mode="before")
    @classmethod
    def _coerce_difficulty(cls, value: object) -> Dict[str, int]:
        if not isinstance(value, dict):
            return {}
        sanitized: Dict[str, int] = {}
        for key, raw in value.items():
            try:
                sanitized[key] = int(raw)  # type: ignore[arg-type]
            except (TypeError, ValueError):
                continue
        return sanitized


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
    merged = UserPreferences(
        difficulty={**existing.difficulty, **update.difficulty}
    )
    await cache.set(key, merged.model_dump(mode="json"))
    return merged
