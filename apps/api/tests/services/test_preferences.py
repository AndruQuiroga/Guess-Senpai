import asyncio

from app.core.config import settings
from app.services.cache import get_cache
from app.services.preferences import (
    MAX_DIFFICULTY_LEVEL,
    PREFERENCE_KEY_TEMPLATE,
    UserPreferences,
    load_user_preferences,
    update_user_preferences,
)


def test_preference_roundtrip_and_merge() -> None:
    user_id = 404

    async def _scenario() -> None:
        baseline = await load_user_preferences(user_id)
        assert baseline.difficulty_level is None

        first = await update_user_preferences(
            user_id,
            UserPreferences(difficulty_level=2),
        )
        assert first.difficulty_level == 2

        cached = await load_user_preferences(user_id)
        assert cached.difficulty_level == 2

        merged = await update_user_preferences(
            user_id,
            UserPreferences(),
        )
        assert merged.difficulty_level == 2

        cleared = await update_user_preferences(
            user_id,
            UserPreferences(difficulty_level=None),
        )
        assert cleared.difficulty_level is None

    asyncio.run(_scenario())


def test_invalid_preference_values_are_ignored() -> None:
    user_id = 505

    async def _scenario() -> None:
        noisy = await update_user_preferences(
            user_id,
            UserPreferences(difficulty_level="not-a-number"),
        )
        assert noisy.difficulty_level is None

        fallback = await load_user_preferences(user_id)
        assert fallback.difficulty_level is None

        clamped = await update_user_preferences(
            user_id,
            UserPreferences(difficulty_level=99),
        )
        assert clamped.difficulty_level == MAX_DIFFICULTY_LEVEL

    asyncio.run(_scenario())


def test_legacy_dictionary_payload_is_migrated() -> None:
    user_id = 606

    async def _scenario() -> None:
        cache = await get_cache(settings.redis_url)
        key = PREFERENCE_KEY_TEMPLATE.format(user_id=user_id)
        await cache.set(
            key,
            {
                "difficulty": {
                    "anidle": 4,
                    "poster": "2",
                    "invalid": "nope",
                }
            },
        )

        migrated = await load_user_preferences(user_id)
        assert migrated.difficulty_level == MAX_DIFFICULTY_LEVEL

    asyncio.run(_scenario())
