import asyncio

from app.services.preferences import (
    UserPreferences,
    load_user_preferences,
    update_user_preferences,
)


def test_preference_roundtrip_and_merge() -> None:
    user_id = 404

    async def _scenario() -> None:
        baseline = await load_user_preferences(user_id)
        assert baseline.difficulty == {}

        first = await update_user_preferences(
            user_id,
            UserPreferences(difficulty={"anidle": 2, "poster": "3"}),
        )
        assert first.difficulty == {"anidle": 2, "poster": 3}

        cached = await load_user_preferences(user_id)
        assert cached.difficulty == {"anidle": 2, "poster": 3}

        merged = await update_user_preferences(
            user_id,
            UserPreferences(difficulty={"poster": 1, "redacted_synopsis": 4}),
        )
        assert merged.difficulty == {
            "anidle": 2,
            "poster": 1,
            "redacted_synopsis": 4,
        }

    asyncio.run(_scenario())


def test_invalid_preference_values_are_ignored() -> None:
    user_id = 505

    async def _scenario() -> None:
        noisy = await update_user_preferences(
            user_id,
            UserPreferences(difficulty={"anidle": "not-a-number", "poster": None}),
        )
        assert noisy.difficulty == {}

        fallback = await load_user_preferences(user_id)
        assert fallback.difficulty == {}

    asyncio.run(_scenario())
