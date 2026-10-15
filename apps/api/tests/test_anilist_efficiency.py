"""AniList request budget: batching, pool-as-details, pacing and coalescing.

Every test talks to a fake `anilist._send`; nothing reaches the network.
"""

from __future__ import annotations

import asyncio
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

import httpx
import pytest
from starlette.requests import Request

from app.core.config import settings
from app.puzzles import engine
from app.routers import puzzles as puzzles_router
from app.services import anilist, anidle_evaluator
from app.services.anilist import Media
from app.services.anidle_evaluator import AnidleEvaluationService
from app.services.cache import InMemoryCache

POOL_SIZE = engine.POPULAR_POOL_PAGES * anilist.MAX_PER_PAGE


def full_media(media_id: int, rank: int) -> Dict[str, Any]:
    """A details record as AniList returns it (pool and details share fields)."""
    title = f"Show {media_id}"
    return {
        "id": media_id,
        "title": {"romaji": title, "english": title, "native": None, "userPreferred": title},
        "synonyms": [],
        "season": "SPRING",
        "seasonYear": 2015,
        "startDate": {"year": 2015},
        "episodes": 12,
        "duration": 24,
        "genres": ["Action", "Drama"],
        "tags": [{"name": "Heroes", "rank": 90, "isGeneralSpoiler": False}],
        "popularity": 500_000 - rank * 1_000,
        "averageScore": 80,
        "source": "MANGA",
        "description": f"{title} follows a crew of travellers across a strange and distant land.",
        "status": "FINISHED",
        "format": "TV",
        "coverImage": {"extraLarge": f"https://img.example/{media_id}.jpg", "large": None, "medium": None, "color": None},
        "bannerImage": None,
        "isAdult": False,
        "studios": {"edges": [{"isMain": True, "node": {"id": 1, "name": "Studio"}}]},
        "relations": {"edges": []},
        "rankings": [],
        "trailer": None,
        "externalLinks": [{"site": "Crunchyroll", "url": f"https://example.com/{media_id}"}],
        "characters": {
            "edges": [
                {
                    "role": "MAIN",
                    "node": {
                        "id": media_id * 10 + offset,
                        "name": {"full": f"Hero {media_id}-{offset}", "native": None, "userPreferred": None},
                        "image": {"large": f"https://img.example/c{media_id}-{offset}.jpg", "medium": None},
                    },
                }
                for offset in range(2)
            ]
        },
    }


UNIVERSE: Dict[int, Dict[str, Any]] = {1000 + rank: full_media(1000 + rank, rank) for rank in range(POOL_SIZE)}


class FakeAniList:
    """Answers the pool, batch and search queries from `UNIVERSE`."""

    def __init__(self, *, headers: Dict[str, str] | None = None) -> None:
        self.calls: List[Dict[str, Any]] = []
        self.headers = headers or {"X-RateLimit-Limit": "90", "X-RateLimit-Remaining": "80"}
        self.queue: List[httpx.Response] = []

    def respond(self, status: int, payload: Dict[str, Any], headers: Dict[str, str] | None = None) -> httpx.Response:
        return httpx.Response(
            status,
            json=payload,
            headers=headers if headers is not None else self.headers,
            request=httpx.Request("POST", anilist.ANILIST_GQL),
        )

    async def __call__(self, body: Dict[str, Any], headers: Dict[str, str]) -> httpx.Response:
        self.calls.append(body)
        await asyncio.sleep(0)
        if self.queue:
            return self.queue.pop(0)
        query, variables = body["query"], body["variables"]
        if "PopularPool" in query:
            per_page = min(variables["perPage"], anilist.MAX_PER_PAGE)
            ordered = sorted(UNIVERSE.values(), key=lambda item: -item["popularity"])
            start = (variables["page"] - 1) * per_page
            page = ordered[start : start + per_page]
            return self.respond(200, {"data": {"Page": {
                "pageInfo": {"total": len(ordered), "currentPage": variables["page"], "hasNextPage": start + per_page < len(ordered)},
                "media": page,
            }}})
        if "MediaDetailsBatch" in query:
            media = [UNIVERSE[media_id] for media_id in variables["ids"] if media_id in UNIVERSE]
            return self.respond(200, {"data": {"Page": {"media": media}}})
        if "SearchMedia" in query:
            return self.respond(200, {"data": {"Page": {"media": [
                {"id": item["id"], "title": item["title"]} for item in list(UNIVERSE.values())[:3]
            ]}}})
        raise AssertionError(f"unexpected query {query[:40]}")

    def count(self, name: str) -> int:
        return sum(1 for call in self.calls if name in call["query"])


@pytest.fixture
def fake_anilist(monkeypatch: pytest.MonkeyPatch) -> FakeAniList:
    fake = FakeAniList()
    monkeypatch.setattr(anilist, "_send", fake)
    return fake


@pytest.fixture
def memory_cache(monkeypatch: pytest.MonkeyPatch) -> InMemoryCache:
    cache = InMemoryCache()

    async def get_cache() -> InMemoryCache:
        return cache

    monkeypatch.setattr(engine, "_get_cache", get_cache)
    return cache


# --- batching ---------------------------------------------------------------


@pytest.mark.asyncio
async def test_batch_details_use_one_request_per_fifty_ids(fake_anilist: FakeAniList) -> None:
    ids = list(UNIVERSE)[:120] + [999_999]
    found = await anilist.fetch_media_details_batch(ids)
    assert fake_anilist.count("MediaDetailsBatch") == 3
    assert set(found) == set(ids[:120])
    assert all(len(call["variables"]["ids"]) <= 50 for call in fake_anilist.calls)


@pytest.mark.asyncio
async def test_load_many_serves_cache_and_remembers_unknown_ids(fake_anilist: FakeAniList) -> None:
    cache = InMemoryCache()
    cached_id, fresh_ids = 1000, [1001, 1002]
    await cache.set(engine._media_cache_key(cached_id), UNIVERSE[cached_id], 60)

    found = await engine._load_media_details_many([cached_id, *fresh_ids, 424242], cache, settings)
    assert set(found) == {cached_id, *fresh_ids}
    assert fake_anilist.count("MediaDetailsBatch") == 1
    assert fake_anilist.calls[0]["variables"]["ids"] == [*fresh_ids, 424242]

    # Everything is now cached, including the unknown id's absence.
    await engine._load_media_details_many([cached_id, *fresh_ids, 424242], cache, settings)
    with pytest.raises(LookupError):
        await engine._load_media_details(424242, cache, settings)
    assert len(fake_anilist.calls) == 1


# --- popular pool -------------------------------------------------------------


@pytest.mark.asyncio
async def test_pool_is_fetched_once_per_utc_day_and_seeds_details(fake_anilist: FakeAniList) -> None:
    cache = InMemoryCache()
    today = datetime.now(timezone.utc).date()
    pool = await engine._load_popular_pool(today, cache, settings)
    assert len(pool) == POOL_SIZE
    assert fake_anilist.count("PopularPool") == engine.POPULAR_POOL_PAGES
    assert all(call["variables"]["perPage"] == anilist.MAX_PER_PAGE for call in fake_anilist.calls)

    # Archive days generated today share the same ranking fetch...
    for offset in range(1, 15):
        again = await engine._load_popular_pool(today - timedelta(days=offset), cache, settings)
        assert [media.id for media in again] == [media.id for media in pool]
    # ...and every pool member's details are already cached.
    details = await engine._load_media_details(pool[-1].id, cache, settings)
    assert details.characters and details.studios and details.externalLinks
    assert len(fake_anilist.calls) == engine.POPULAR_POOL_PAGES


@pytest.mark.asyncio
async def test_cold_daily_generation_costs_only_the_pool_pages(fake_anilist: FakeAniList, memory_cache) -> None:
    today = datetime.now(timezone.utc).date()
    published = await engine.publish_daily_puzzle(today, include_guess_opening=False)
    assert published.games.character_silhouette.puzzle.rounds
    assert len(fake_anilist.calls) == engine.POPULAR_POOL_PAGES

    # Backfilling two weeks of archive adds no AniList requests at all.
    for offset in range(1, 15):
        await engine.publish_daily_puzzle(today - timedelta(days=offset), include_guess_opening=False)
    assert len(fake_anilist.calls) == engine.POPULAR_POOL_PAGES


@pytest.mark.asyncio
async def test_pool_details_build_the_same_set_as_per_anime_lookups(
    fake_anilist: FakeAniList, memory_cache, monkeypatch: pytest.MonkeyPatch
) -> None:
    day = datetime.now(timezone.utc).date()
    new_path = await engine._assemble_daily_puzzle(day, user=None, include_guess_opening=False, cache=memory_cache)

    # The previous flow: a pool without details plus one lookup per anime.
    slim_pool = [
        Media.model_validate({**item, "characters": None, "studios": None, "externalLinks": None, "source": None})
        for item in sorted(UNIVERSE.values(), key=lambda item: -item["popularity"])
    ]

    async def slim_popular(*_args):
        return slim_pool

    async def per_anime_details(media_id, *_args):
        return Media.model_validate(UNIVERSE[media_id])

    monkeypatch.setattr(engine, "_load_popular_pool", slim_popular)
    monkeypatch.setattr(engine, "_load_media_details", per_anime_details)
    old_path = await engine._assemble_daily_puzzle(day, user=None, include_guess_opening=False, cache=InMemoryCache())
    assert new_path.model_dump(mode="json") == old_path.model_dump(mode="json")


# --- gameplay paths -----------------------------------------------------------


@pytest.mark.asyncio
async def test_search_warms_all_hits_with_one_batch(fake_anilist: FakeAniList, monkeypatch: pytest.MonkeyPatch) -> None:
    cache = InMemoryCache()

    async def get_cache(_url=None):
        return cache

    async def empty_index(session, query, limit=8):
        return []

    monkeypatch.setattr(puzzles_router, "get_cache", get_cache)
    monkeypatch.setattr(puzzles_router.title_index, "search_titles", empty_index)
    request = Request(scope={"type": "http", "headers": [], "app": None})
    response = await puzzles_router.search_titles(request, q="Show", limit=8)
    assert len(response.results) == 3
    assert fake_anilist.count("SearchMedia") == 1
    assert fake_anilist.count("MediaDetailsBatch") == 1
    assert len(fake_anilist.calls) == 2


@pytest.mark.asyncio
async def test_evaluator_shares_the_search_cache_and_batches_candidates(
    fake_anilist: FakeAniList, monkeypatch: pytest.MonkeyPatch
) -> None:
    cache = InMemoryCache()

    async def empty_index(session, query, limit=5):
        return []

    monkeypatch.setattr(anidle_evaluator.title_index, "search_titles", empty_index)
    from app.core.database import get_session_factory

    payload = anidle_evaluator.AnidleGuessEvaluationPayload(puzzle_media_id=1050, guess="Nothing Exact")
    for _ in range(2):  # two separate requests
        service = AnidleEvaluationService(cache=cache, session_factory=get_session_factory(), user=None)
        result = await service.evaluate_guess(payload)
        assert result.matched
    # Target + all search hits in one batch; the second request is fully cached.
    assert fake_anilist.count("SearchMedia") == 1
    assert fake_anilist.count("MediaDetailsBatch") == 2
    assert len(fake_anilist.calls) == 3


@pytest.mark.asyncio
async def test_verify_loads_answer_and_guess_in_one_request(fake_anilist: FakeAniList, monkeypatch) -> None:
    cache = InMemoryCache()

    async def get_cache(_url=None):
        return cache

    monkeypatch.setattr(puzzles_router, "get_cache", get_cache)
    response = await puzzles_router.verify_guess(
        puzzles_router.GuessVerificationPayload(media_id=1001, guess="Show 1002", guess_media_id=1002)
    )
    assert response.correct is False
    assert len(fake_anilist.calls) == 1


# --- pacing, 429 handling and coalescing -----------------------------------------


@pytest.mark.asyncio
async def test_429_is_retried_after_retry_after(fake_anilist: FakeAniList) -> None:
    fake_anilist.queue.append(
        fake_anilist.respond(429, {"errors": [{"message": "Too Many Requests."}]}, {"Retry-After": "0.05"})
    )
    started = time.monotonic()
    data = await anilist.gql_request(anilist.MEDIA_DETAILS_BATCH_QUERY, {"ids": [1000], "perPage": 1})
    assert data["Page"]["media"][0]["id"] == 1000
    assert len(fake_anilist.calls) == 2
    assert time.monotonic() - started >= 0.04


@pytest.mark.asyncio
async def test_long_retry_after_fails_fast_unless_the_caller_is_patient(fake_anilist: FakeAniList) -> None:
    fake_anilist.queue.append(
        fake_anilist.respond(429, {"errors": [{"message": "Too Many Requests."}]}, {"Retry-After": "30"})
    )
    started = time.monotonic()
    with pytest.raises(anilist.AniListRateLimited) as excinfo:
        await anilist.gql_request(anilist.MEDIA_DETAILS_BATCH_QUERY, {"ids": [1000], "perPage": 1})
    assert excinfo.value.retry_after == pytest.approx(30)
    assert time.monotonic() - started < 1
    # Later calls respect the block instead of tripping the limit again.
    with pytest.raises(anilist.AniListRateLimited):
        await anilist.gql_request(anilist.MEDIA_DETAILS_BATCH_QUERY, {"ids": [1001], "perPage": 1})
    assert len(fake_anilist.calls) == 1


@pytest.mark.asyncio
async def test_patient_callers_wait_out_the_block(fake_anilist: FakeAniList) -> None:
    fake_anilist.queue.append(
        fake_anilist.respond(429, {"errors": [{"message": "Too Many Requests."}]}, {"Retry-After": "0.2"})
    )
    with anilist.rate_limit_patience(0.1):
        with pytest.raises(anilist.AniListRateLimited):
            await anilist.gql_request(anilist.MEDIA_DETAILS_BATCH_QUERY, {"ids": [1000], "perPage": 1})
    with anilist.rate_limit_patience(5):
        data = await anilist.gql_request(anilist.MEDIA_DETAILS_BATCH_QUERY, {"ids": [1000], "perPage": 1})
    assert data["Page"]["media"]


def test_gate_paces_to_the_reported_limit() -> None:
    gate = anilist._RateGate()
    gate.observe(200, httpx.Headers({"X-RateLimit-Limit": "3", "X-RateLimit-Remaining": "3"}), 0.0)
    gate.record_send(0.0)
    assert gate.delay(1.0) == 0
    gate.record_send(1.0)
    # One slot is kept in reserve: the third request waits for the window.
    assert gate.delay(2.0) == pytest.approx(58.0)
    assert gate.delay(61.0) == 0

    exhausted = anilist._RateGate()
    exhausted.observe(200, httpx.Headers({"X-RateLimit-Limit": "90", "X-RateLimit-Remaining": "0"}), 0.0)
    assert exhausted.delay(0.0) > 0
    assert exhausted.delay(60.0) == 0


def test_exhausted_gate_recovers_after_its_last_send_ages_out() -> None:
    gate = anilist._RateGate()
    gate.record_send(0.0)
    gate.observe(200, httpx.Headers({"X-RateLimit-Remaining": "0"}), 1.0)
    assert gate.delay(60.0) == pytest.approx(1.0)
    assert gate.delay(61.0) == 0
    gate.record_send(61.0)
    assert gate.delay(62.0) == 0


def test_gate_uses_reported_reset_and_preserves_long_retry_after(monkeypatch) -> None:
    monkeypatch.setattr(anilist.time, "time", lambda: 1_000.0)
    gate = anilist._RateGate()
    gate.observe(200, httpx.Headers({"X-RateLimit-Remaining": "0", "X-RateLimit-Reset": "1010"}), 5.0)
    assert gate.delay(5.0) == pytest.approx(10.0)
    assert gate.delay(15.0) == 0
    assert gate.observe(429, httpx.Headers({"Retry-After": "300"}), 20.0) == 300
    assert gate.delay(21.0) == pytest.approx(299.0)


@pytest.mark.asyncio
async def test_identical_concurrent_requests_share_one_call(fake_anilist: FakeAniList) -> None:
    variables = {"ids": [1000, 1001], "perPage": 2}
    results = await asyncio.gather(
        *(anilist.gql_request(anilist.MEDIA_DETAILS_BATCH_QUERY, dict(variables)) for _ in range(5))
    )
    assert len(fake_anilist.calls) == 1
    assert all(result == results[0] for result in results)
    # Once settled, a new request goes upstream again.
    await anilist.gql_request(anilist.MEDIA_DETAILS_BATCH_QUERY, variables)
    assert len(fake_anilist.calls) == 2


def test_search_cache_keys_keep_non_latin_terms_apart() -> None:
    assert engine._search_cache_key("進撃の巨人", 5) != engine._search_cache_key("鬼滅の刃", 5)
    assert engine._search_cache_key("AoT", 5) == engine._search_cache_key(" aot ", 5)
    assert engine._search_cache_key("Naruto 疾風伝", 5) != engine._search_cache_key("Naruto", 5)
    assert engine._search_cache_key("K-On!", 5) != engine._search_cache_key("K On", 5)
