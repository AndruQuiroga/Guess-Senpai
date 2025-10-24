from __future__ import annotations

from datetime import date
from typing import Any

import pytest

from app.puzzles import engine
from app.puzzles.engine import UserContext
from app.puzzles.models import (
    GuessOpeningGame,
    GuessOpeningMeta,
    OpeningClip,
    RoundSpec,
)
from app.services.anilist import Media, Title


class DummyCache:
    def __init__(self) -> None:
        self._storage: dict[str, Any] = {}

    async def remember(self, key: str, ttl: int, creator):  # type: ignore[override]
        if key in self._storage:
            return self._storage[key]
        value = await creator()
        self._storage[key] = value
        return value

    async def set(self, key: str, value: Any, ttl: int) -> None:
        self._storage[key] = value

    async def get(self, key: str) -> Any:
        return self._storage.get(key)


def make_media(media_id: int, title: str) -> Media:
    return Media(
        id=media_id,
        title=Title(english=title, userPreferred=title),
        genres=["Action"],
        season="SPRING",
        seasonYear=2024,
        episodes=12,
        duration=24,
        popularity=1000,
        averageScore=75,
        description=f"Synopsis for {title}",
        format="TV",
        externalLinks=[{"site": "Crunchyroll", "url": f"https://example.com/{media_id}"}],
    )


def make_guess_opening(media: Media) -> GuessOpeningGame:
    return GuessOpeningGame(
        spec=[RoundSpec(difficulty=1, hints=["length"])],
        answer=media.title.english or "Unknown",
        clip=OpeningClip(audioUrl="https://cdn.example.com/opening.mp3", lengthSeconds=90),
        meta=GuessOpeningMeta(songTitle="Theme", artist="Singer"),
    )


@pytest.mark.asyncio
async def test_daily_puzzle_builds_distinct_bundles(monkeypatch: pytest.MonkeyPatch) -> None:
    day = date(2024, 1, 5)
    popular = [
        make_media(101, "Alpha"),
        make_media(202, "Beta"),
        make_media(303, "Gamma"),
        make_media(404, "Delta"),
    ]
    media_by_id = {media.id: media for media in popular}

    async def fake_load_popular_pool(day_value, cache, settings):
        return list(popular)

    async def fake_load_media_details(media_id: int, cache, settings):
        return media_by_id[media_id]

    async def fake_build_guess_opening(media: Media, cache):
        return make_guess_opening(media)

    monkeypatch.setattr(engine, "_load_popular_pool", fake_load_popular_pool)
    monkeypatch.setattr(engine, "_load_media_details", fake_load_media_details)
    monkeypatch.setattr(engine, "_build_guess_opening", fake_build_guess_opening)

    cache = DummyCache()
    result = await engine._assemble_daily_puzzle(
        day,
        user=None,
        include_guess_opening=True,
        cache=cache,
    )

    assert result.guess_the_opening_enabled is bool(result.games.guess_the_opening)

    bundle_ids = [
        result.games.anidle.mediaId,
        result.games.poster_zoomed.mediaId,
        result.games.redacted_synopsis.mediaId,
    ]
    if result.games.guess_the_opening:
        bundle_ids.append(result.games.guess_the_opening.mediaId)

    assert len(bundle_ids) == len(set(bundle_ids))
    assert result.games.anidle.solution.aniListUrl.endswith(
        str(result.games.anidle.mediaId)
    )


@pytest.mark.asyncio
async def test_recent_media_records_all_selected(monkeypatch: pytest.MonkeyPatch) -> None:
    day = date(2024, 1, 6)
    popular = [
        make_media(111, "A"),
        make_media(222, "B"),
        make_media(333, "C"),
        make_media(444, "D"),
    ]
    media_by_id = {media.id: media for media in popular}

    async def fake_load_popular_pool(day_value, cache, settings):
        return list(popular)

    async def fake_load_media_details(media_id: int, cache, settings):
        return media_by_id[media_id]

    attempts: list[int] = []

    async def fake_build_guess_opening(media: Media, cache):
        attempts.append(media.id)
        if len(attempts) == 1:
            return None
        return make_guess_opening(media)

    recorded: list[int] = []

    async def fake_record_recent_media(cache, user_id: int, media_id: int) -> None:
        recorded.append(media_id)

    async def fake_fetch_user_lists(cache, user):
        return None

    async def fake_get_recent_media(cache, user_id: int):
        return []

    monkeypatch.setattr(engine, "_load_popular_pool", fake_load_popular_pool)
    monkeypatch.setattr(engine, "_load_media_details", fake_load_media_details)
    monkeypatch.setattr(engine, "_build_guess_opening", fake_build_guess_opening)
    monkeypatch.setattr(engine, "_record_recent_media", fake_record_recent_media)
    monkeypatch.setattr(engine, "_fetch_user_lists", fake_fetch_user_lists)
    monkeypatch.setattr(engine, "_get_recent_media", fake_get_recent_media)

    cache = DummyCache()
    user = UserContext(user_id=9, username="tester", access_token="token")
    result = await engine._assemble_daily_puzzle(
        day,
        user=user,
        include_guess_opening=True,
        cache=cache,
    )

    bundle_ids = [
        result.games.anidle.mediaId,
        result.games.poster_zoomed.mediaId,
        result.games.redacted_synopsis.mediaId,
    ]
    if result.games.guess_the_opening:
        bundle_ids.append(result.games.guess_the_opening.mediaId)

    assert set(recorded) == set(bundle_ids)
    assert len(recorded) == len(bundle_ids)
    assert result.games.guess_the_opening is not None
    assert len(attempts) >= 2
    assert attempts[-1] == result.games.guess_the_opening.mediaId
