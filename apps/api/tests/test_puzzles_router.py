from __future__ import annotations

import pytest
from starlette.requests import Request

from app.core.database import get_session_factory
from app.puzzles import engine as puzzle_engine
from app.puzzles.engine import _title_variants
from app.routers import puzzles as puzzles_router
from app.routers.puzzles import AnidleGuessEvaluationPayload
from app.services import title_index
from app.services.anilist import Media, MediaTitlePair, Title


def make_media(media_id: int, title_text: str) -> Media:
    return Media(
        id=media_id,
        title=Title(
            userPreferred=title_text,
            english=title_text,
            romaji=title_text,
            native=title_text,
        ),
        synonyms=[title_text],
        format="TV",
    )


@pytest.mark.asyncio
async def test_search_titles_prefers_index(monkeypatch: pytest.MonkeyPatch) -> None:
    media = make_media(9001, "Indexed Story")
    session_factory = get_session_factory()

    async with session_factory() as session:
        await title_index.ingest_media(session, media, _title_variants(media))
        await session.commit()

    called_remote = False

    async def fake_search_media(*args, **kwargs):
        nonlocal called_remote
        called_remote = True
        return []

    monkeypatch.setattr(puzzles_router, "search_media", fake_search_media)

    request = Request(scope={"type": "http", "headers": [], "app": None})
    response = await puzzles_router.search_titles(request, q="Indexed", limit=5)

    assert response.results
    assert response.results[0].id == media.id
    assert not called_remote


@pytest.mark.asyncio
async def test_search_titles_falls_back_to_remote(monkeypatch: pytest.MonkeyPatch) -> None:
    remote_media = make_media(7777, "Remote Story")

    call_count = {"value": 0}

    async def fake_search_titles(session, query, limit=8):  # type: ignore[override]
        call_count["value"] += 1
        if call_count["value"] == 1:
            return []
        return [
            title_index.TitleMatch(
                media_id=remote_media.id,
                title=remote_media.title.userPreferred or "Remote Story",
                normalized=title_index.normalize_title(remote_media.title.userPreferred),
                source="remote",
                priority=0,
                is_exact=True,
            )
        ]

    async def fake_search_media(query: str, limit: int = 8, token: str | None = None):
        return [MediaTitlePair(id=remote_media.id, title=remote_media.title)]

    async def fake_load_media_details(media_id: int, cache, settings):
        return remote_media

    monkeypatch.setattr(puzzles_router.title_index, "search_titles", fake_search_titles)
    monkeypatch.setattr(puzzles_router, "search_media", fake_search_media)
    monkeypatch.setattr(puzzle_engine, "_load_media_details", fake_load_media_details)

    request = Request(scope={"type": "http", "headers": [], "app": None})
    response = await puzzles_router.search_titles(request, q="Remote", limit=5)

    assert call_count["value"] == 2
    assert response.results
    assert response.results[0].id == remote_media.id


@pytest.mark.asyncio
async def test_evaluate_guess_falls_back_to_remote(monkeypatch: pytest.MonkeyPatch) -> None:
    target_media = make_media(100, "Target Show")
    guess_media = make_media(200, "Guess Show")
    media_by_id = {target_media.id: target_media, guess_media.id: guess_media}

    async def fake_load_media_details(media_id: int, _cache, _settings):
        return media_by_id[media_id]

    async def fake_search_titles(session, query, limit=5):  # type: ignore[override]
        return []

    search_called = False

    async def fake_search_media(query: str, limit: int = 5, token: str | None = None):
        nonlocal search_called
        search_called = True
        return [MediaTitlePair(id=guess_media.id, title=guess_media.title)]

    monkeypatch.setattr(puzzle_engine, "_load_media_details", fake_load_media_details)
    monkeypatch.setattr(puzzles_router.title_index, "search_titles", fake_search_titles)
    monkeypatch.setattr(puzzles_router, "search_media", fake_search_media)

    request = Request(scope={"type": "http", "headers": [], "app": None})
    payload = AnidleGuessEvaluationPayload(puzzle_media_id=target_media.id, guess="Guess Show")

    response = await puzzles_router.evaluate_anidle_guess(request, payload)

    assert search_called
    assert response.title == "Guess Show"
    assert response.correct is False
