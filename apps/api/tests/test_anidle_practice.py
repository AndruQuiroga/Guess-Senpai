from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from sqlalchemy import select
from starlette.requests import Request

from app.core.database import get_session_factory
from app.db.models import DailyPuzzleSet
from app.puzzles import engine
from app.puzzles.models import DailyPuzzleResponse, ensure_utc
from app.routers import puzzles as puzzles_router
from app.routers.puzzles import AnidleGuessEvaluationPayload
from app.services import anidle_evaluator, anidle_practice
from app.services.anilist import (
    AniListError,
    CoverImage,
    MediaList,
    MediaListCollection,
    MediaListEntry,
)
from test_daily_snapshots import local_generation  # noqa: F401  (fixture)
from test_puzzles_engine import make_media


def blank_request() -> Request:
    return Request(scope={"type": "http", "headers": [], "app": None})


async def get_practice(exclude=None, source="popular"):
    return await puzzles_router.get_anidle_practice(blank_request(), exclude=exclude, source=source)


@pytest.fixture
def practice_pool(monkeypatch):
    pool = [make_media(3000 + i, f"Practice {i}") for i in range(6)]

    async def popular(*args):
        return pool

    async def details(media_id, *args):
        return next(media for media in pool if media.id == media_id)

    async def fail_daily(*args, **kwargs):
        raise AssertionError("Practice must never assemble or publish a daily set")

    async def cache():
        return None

    monkeypatch.setattr(engine, "_load_popular_pool", popular)
    monkeypatch.setattr(engine, "_load_media_details", details)
    monkeypatch.setattr(engine, "_assemble_daily_puzzle", fail_daily)
    monkeypatch.setattr(engine, "_get_cache", cache)
    return pool


@pytest.mark.asyncio
async def test_practice_returns_v2_game_from_the_pool_without_publishing(practice_pool):
    response = await get_practice(exclude=None)

    assert response.practice_id.startswith("practice:")
    assert response.rules_version == "2"
    bundle = response.anidle
    assert bundle.mediaId in {media.id for media in practice_pool}
    assert bundle.puzzle.rules is not None
    assert bundle.puzzle.rules.version == "2"
    assert bundle.puzzle.rules.max_attempts == 20
    assert bundle.puzzle.rules.hint_after_incorrect == [10, 13, 16]
    assert bundle.puzzle.answer
    async with get_session_factory()() as session:
        assert (await session.scalars(select(DailyPuzzleSet))).all() == []


@pytest.mark.asyncio
async def test_practice_ids_are_opaque_and_unique(practice_pool):
    ids = {(await get_practice(exclude=None)).practice_id for _ in range(5)}
    assert len(ids) == 5
    assert all(str(media.id) not in practice_id for media in practice_pool for practice_id in ids)


@pytest.mark.asyncio
async def test_practice_avoids_excluded_ids_and_falls_back_when_all_excluded(practice_pool):
    keep = practice_pool[0].id
    others = [media.id for media in practice_pool if media.id != keep]
    for _ in range(10):
        response = await get_practice(exclude=others)
        assert response.anidle.mediaId == keep
    everyone = [media.id for media in practice_pool]
    response = await get_practice(exclude=everyone)
    assert response.anidle.mediaId in everyone


@pytest.mark.asyncio
async def test_practice_empty_pool_is_503(monkeypatch):
    async def empty(*args):
        return []

    async def cache():
        return None

    monkeypatch.setattr(engine, "_load_popular_pool", empty)
    monkeypatch.setattr(engine, "_get_cache", cache)
    with pytest.raises(HTTPException) as failure:
        await get_practice(exclude=None)
    assert failure.value.status_code == 503


@pytest.mark.asyncio
async def test_practice_game_is_evaluated_by_the_existing_endpoint(practice_pool, monkeypatch):
    practice = await get_practice(exclude=None)
    target = next(media for media in practice_pool if media.id == practice.anidle.mediaId)
    guess = next(media for media in practice_pool if media.id != target.id)
    guess.episodes = 24
    guess.format = "TV_SHORT"
    guess.coverImage = CoverImage(large="https://img.example/guess-large.jpg", medium="https://img.example/m.jpg")

    async def no_titles(session, query, limit=5):
        return []

    async def no_remote(*args, **kwargs):
        raise AssertionError("guess_media_id should resolve locally")

    monkeypatch.setattr(anidle_evaluator.title_index, "search_titles", no_titles)
    monkeypatch.setattr(anidle_evaluator, "search_media", no_remote)
    monkeypatch.setattr(puzzles_router, "get_cache", practice_cache)
    request = Request(scope={"type": "http", "headers": [], "app": None})

    wrong = await puzzles_router.evaluate_anidle_guess(
        request,
        AnidleGuessEvaluationPayload(
            puzzle_media_id=practice.anidle.mediaId,
            guess=guess.title.english,
            guess_media_id=guess.id,
        ),
    )
    assert wrong.correct is False
    assert wrong.cover_image == "https://img.example/guess-large.jpg"
    assert wrong.episodes.guess == 24
    assert wrong.episodes.target == target.episodes == 12
    assert wrong.episodes.status == "higher"
    assert [(item.value, item.status) for item in wrong.format] == [("TV Short", "miss")]

    right = await puzzles_router.evaluate_anidle_guess(
        request,
        AnidleGuessEvaluationPayload(
            puzzle_media_id=practice.anidle.mediaId,
            guess=practice.anidle.puzzle.answer,
            guess_media_id=target.id,
        ),
    )
    assert right.correct is True
    assert right.episodes.status == "match"
    assert [(item.value, item.status) for item in right.format] == [("TV", "match")]
    assert right.cover_image is None  # fixture media has no cover art


async def practice_cache(*args, **kwargs):
    return None


@pytest.mark.asyncio
async def test_unresolved_guess_has_unknown_new_fields(practice_pool, monkeypatch):
    async def no_titles(session, query, limit=5):
        return []

    async def no_remote(*args, **kwargs):
        return []

    monkeypatch.setattr(anidle_evaluator.title_index, "search_titles", no_titles)
    monkeypatch.setattr(anidle_evaluator, "search_media", no_remote)
    monkeypatch.setattr(puzzles_router, "get_cache", practice_cache)
    request = Request(scope={"type": "http", "headers": [], "app": None})
    response = await puzzles_router.evaluate_anidle_guess(
        request, AnidleGuessEvaluationPayload(puzzle_media_id=practice_pool[0].id, guess="Nothing Matches")
    )
    assert response.episodes.status == "unknown"
    assert response.format == []
    assert response.cover_image is None
    assert response.matched is False


def list_collection(entries_by_status: dict[str, list]) -> MediaListCollection:
    return MediaListCollection(
        lists=[
            MediaList(
                name=status.title(),
                status=status,
                entries=[MediaListEntry(status=status, media=media) for media in entries],
            )
            for status, entries in entries_by_status.items()
        ]
    )


@pytest.fixture
def signed_in(monkeypatch):
    user = engine.UserContext(user_id=42, username="senpai", access_token="token")

    async def resolve(request):
        return user

    monkeypatch.setattr(puzzles_router, "_resolve_user_context", resolve)
    return user


@pytest.fixture
def list_practice(practice_pool, signed_in, monkeypatch):
    """The player's list: watched shows from the pool, plus ones to never draw."""
    adult = make_media(3100, "Adult")
    adult.isAdult = True
    planned = make_media(3101, "Planned")
    lists = list_collection(
        {
            "COMPLETED": [practice_pool[0], adult],
            "CURRENT": [practice_pool[1]],
            "DROPPED": [practice_pool[0]],  # duplicate entry
            "PLANNING": [planned],
        }
    )
    calls = []

    async def fetch_lists(cache, user):
        calls.append(user.user_id)
        return lists

    async def no_popular(*args):
        raise AssertionError("List practice must not read the popular pool")

    monkeypatch.setattr(engine, "_fetch_user_lists", fetch_lists)
    monkeypatch.setattr(engine, "_load_popular_pool", no_popular)
    return {"watched": {practice_pool[0].id, practice_pool[1].id}, "calls": calls}


@pytest.mark.asyncio
async def test_list_practice_draws_only_watched_anime(list_practice):
    for _ in range(20):
        response = await get_practice(source="list")
        assert response.source == "list"
        assert response.anidle.mediaId in list_practice["watched"]
    assert set(list_practice["calls"]) == {42}


@pytest.mark.asyncio
async def test_list_practice_still_avoids_recent_answers(list_practice):
    first, second = sorted(list_practice["watched"])
    for _ in range(10):
        response = await get_practice(exclude=[first], source="list")
        assert response.anidle.mediaId == second


@pytest.mark.asyncio
async def test_popular_practice_reports_its_source(practice_pool):
    assert (await get_practice()).source == "popular"


@pytest.mark.asyncio
async def test_list_practice_requires_sign_in(practice_pool, monkeypatch):
    async def anonymous(request):
        return None

    monkeypatch.setattr(puzzles_router, "_resolve_user_context", anonymous)
    with pytest.raises(HTTPException) as failure:
        await get_practice(source="list")
    assert failure.value.status_code == 401


@pytest.mark.asyncio
async def test_list_without_watched_anime_is_404(practice_pool, signed_in, monkeypatch):
    async def only_planned(cache, user):
        return list_collection({"PLANNING": [practice_pool[0]]})

    monkeypatch.setattr(engine, "_fetch_user_lists", only_planned)
    with pytest.raises(HTTPException) as failure:
        await get_practice(source="list")
    assert failure.value.status_code == 404
    assert "no watched anime" in failure.value.detail


@pytest.mark.asyncio
async def test_unreadable_list_is_502(practice_pool, signed_in, monkeypatch):
    async def broken(cache, user):
        raise AniListError("Invalid token")

    monkeypatch.setattr(engine, "_fetch_user_lists", broken)
    with pytest.raises(HTTPException) as failure:
        await get_practice(source="list")
    assert failure.value.status_code == 502


def test_practice_id_helper_prefix():
    assert anidle_practice.new_practice_id().startswith("practice:")


def test_ensure_utc_handles_naive_and_offset_values():
    naive = datetime(2026, 10, 13, 0, 0)
    assert ensure_utc(naive) == datetime(2026, 10, 13, tzinfo=timezone.utc)
    plus_two = datetime(2026, 10, 13, 2, 0, tzinfo=timezone(timedelta(hours=2)))
    assert ensure_utc(plus_two).utcoffset() == timedelta(0)
    assert ensure_utc(plus_two).hour == 0


@pytest.mark.asyncio
async def test_reset_at_has_explicit_utc_offset_everywhere(local_generation):  # noqa: F811
    day = datetime.now(timezone.utc).date()
    expected = f"{(day + timedelta(days=1)).isoformat()}T00:00:00Z"

    first = await engine.get_daily_puzzle(day)  # freshly generated and stored
    assert first.model_dump(mode="json")["reset_at"] == expected

    # SQLite returns naive datetimes for the stored row; the response must still say UTC.
    async with get_session_factory()() as session:
        row = await session.get(DailyPuzzleSet, day)
    assert row is not None
    row.reset_at = row.reset_at.replace(tzinfo=None)
    republished = engine._daily_response(row)
    assert isinstance(republished, DailyPuzzleResponse)
    assert republished.model_dump(mode="json")["reset_at"] == expected
    assert f'"reset_at":"{expected}"' in republished.model_dump_json()

    availability = await puzzles_router.get_daily_availability()
    assert availability.published is True
    assert availability.model_dump(mode="json")["reset_at"] == expected


@pytest.mark.asyncio
async def test_unpublished_availability_reset_at_is_utc():
    availability = await puzzles_router.get_daily_availability()
    assert availability.published is False
    assert availability.model_dump(mode="json")["reset_at"].endswith("Z")


@pytest.mark.asyncio
async def test_published_sets_serve_current_anidle_rules(local_generation):  # noqa: F811
    day = datetime.now(timezone.utc).date()
    await engine.get_daily_puzzle(day)
    async with get_session_factory()() as session:
        row = await session.get(DailyPuzzleSet, day)
    assert row is not None
    content = dict(row.content)
    # Simulate a set published under the old eight-guess defaults.
    content["games"]["anidle"]["puzzle"]["rules"] = {
        "version": "2",
        "max_attempts": 8,
        "hint_after_incorrect": [2, 4, 6],
    }
    row.content = content
    rules = engine._daily_response(row).games.anidle.puzzle.rules
    assert rules is not None
    assert rules.max_attempts == 20
    assert rules.hint_after_incorrect == [10, 13, 16]
