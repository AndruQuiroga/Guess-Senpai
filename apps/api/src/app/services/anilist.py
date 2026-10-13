from __future__ import annotations

import asyncio
import json
import time
from collections import deque
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Any, Deque, Dict, Iterator, List, Optional, Sequence, Set, Tuple

import httpx
from pydantic import BaseModel, Field

from .cache import CacheBackend

ANILIST_GQL = "https://graphql.anilist.co"
ANILIST_AUTH_BASE = "https://anilist.co/api/v2/oauth"
# AniList's largest page size; anything bigger is silently clamped to it.
MAX_PER_PAGE = 50


class AniListError(RuntimeError):
    """Raised when AniList returns an error payload."""


class Title(BaseModel):
    romaji: Optional[str] = None
    english: Optional[str] = None
    native: Optional[str] = None
    userPreferred: Optional[str] = None


class MediaTitlePair(BaseModel):
    id: int
    title: Title


class CoverImage(BaseModel):
    extraLarge: Optional[str] = None
    large: Optional[str] = None
    medium: Optional[str] = None
    color: Optional[str] = None


class Tag(BaseModel):
    name: str
    rank: Optional[int] = None
    isGeneralSpoiler: Optional[bool] = None


class StudioNode(BaseModel):
    id: Optional[int] = None
    name: Optional[str] = None


class MediaStudioEdge(BaseModel):
    isMain: Optional[bool] = None
    node: Optional[StudioNode] = None


class MediaStudios(BaseModel):
    edges: List[MediaStudioEdge] = Field(default_factory=list)


class CharacterName(BaseModel):
    full: Optional[str] = None
    native: Optional[str] = None
    userPreferred: Optional[str] = None


class CharacterImage(BaseModel):
    large: Optional[str] = None
    medium: Optional[str] = None


class Character(BaseModel):
    id: int
    name: CharacterName
    image: Optional[CharacterImage] = None


class MediaCharacterEdge(BaseModel):
    role: Optional[str] = None
    node: Character


class MediaCharacters(BaseModel):
    edges: List[MediaCharacterEdge] = Field(default_factory=list)


class Media(BaseModel):
    id: int
    title: Title
    synonyms: List[str] = Field(default_factory=list)
    season: Optional[str] = None
    seasonYear: Optional[int] = None
    startDate: Optional[Dict[str, Optional[int]]] = None
    episodes: Optional[int] = None
    duration: Optional[int] = None
    genres: List[str] = Field(default_factory=list)
    tags: List[Tag] = Field(default_factory=list)
    popularity: Optional[int] = None
    averageScore: Optional[int] = None
    source: Optional[str] = None
    studios: Optional[MediaStudios] = None
    description: Optional[str] = None
    status: Optional[str] = None
    format: Optional[str] = None
    coverImage: Optional[CoverImage] = None
    bannerImage: Optional[str] = None
    isAdult: Optional[bool] = None
    relations: Optional[Dict[str, Any]] = None
    rankings: Optional[List[Dict[str, Any]]] = None
    trailer: Optional[Dict[str, Any]] = None
    externalLinks: Optional[List[Dict[str, Any]]] = None
    characters: Optional[MediaCharacters] = None


class MediaListEntry(BaseModel):
    status: Optional[str] = None
    score: Optional[float] = None
    progress: Optional[int] = None
    updatedAt: Optional[int] = None
    media: Media


class MediaList(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    entries: List[MediaListEntry] = Field(default_factory=list)


class MediaListCollection(BaseModel):
    lists: List[MediaList] = Field(default_factory=list)


class TokenResponse(BaseModel):
    token_type: str
    access_token: str
    expires_in: int
    refresh_token: Optional[str] = None


VIEWER_QUERY = """
query AuthenticatedViewer {
  Viewer {
    id
    name
    avatar { large medium }
  }
}
"""


# Everything the engine, evaluator and title/character indexes read from a
# media. Shared by the single, batch and popular-pool queries so a pool item is
# a complete details record and no follow-up lookup is needed. A page of 50
# with these fields was confirmed to stay under AniList's query complexity cap.
MEDIA_DETAIL_FIELDS = """
    id
    title {
      romaji
      english
      native
      userPreferred
    }
    synonyms
    season
    seasonYear
    startDate { year }
    episodes
    duration
    genres
    tags { name rank isGeneralSpoiler }
    popularity
    averageScore
    source
    description(asHtml: false)
    status
    format
    coverImage { extraLarge large medium color }
    bannerImage
    isAdult
    studios {
      edges {
        isMain
        node { id name }
      }
    }
    relations {
      edges {
        relationType
        node {
          id
          title { romaji }
          type
          format
        }
      }
    }
    rankings {
      season
      year
      rank
      type
    }
    trailer {
      site
      id
      thumbnail
    }
    externalLinks {
      site
      url
    }
    characters(perPage: 10, sort: [ROLE, RELEVANCE]) {
      edges {
        role
        node {
          id
          name {
            full
            native
            userPreferred
          }
          image {
            large
            medium
          }
        }
      }
    }
"""

POPULAR_POOL_QUERY = """
query PopularPool($page: Int!, $perPage: Int!) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      total
      currentPage
      hasNextPage
    }
    media(
      type: ANIME
      sort: [POPULARITY_DESC, SCORE_DESC]
      isAdult: false
      format_in: [TV, TV_SHORT, MOVIE, ONA, OVA]
      status_not_in: [NOT_YET_RELEASED, CANCELLED]
    ) {
%s
    }
  }
}
""" % MEDIA_DETAIL_FIELDS

TOP_RATED_QUERY = """
query TopRated($page: Int!, $perPage: Int!) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      total
      currentPage
      hasNextPage
    }
    media(
      type: ANIME
      sort: [SCORE_DESC, POPULARITY_DESC]
      isAdult: false
      format_in: [TV, TV_SHORT, MOVIE, ONA, OVA]
      status_not_in: [NOT_YET_RELEASED, CANCELLED]
    ) {
      id
      title {
        romaji
        english
        native
        userPreferred
      }
      synonyms
      season
      seasonYear
      startDate { year }
      episodes
      duration
      genres
      tags { name rank isGeneralSpoiler }
      popularity
      averageScore
      description(asHtml: false)
      status
      format
      coverImage { extraLarge large medium color }
      bannerImage
      isAdult
      relations { edges { relationType } }
    }
  }
}
"""

TOP_POPULAR_QUERY = """
query TopPopular($page: Int!, $perPage: Int!) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      total
      currentPage
      hasNextPage
    }
    media(
      type: ANIME
      sort: [POPULARITY_DESC, SCORE_DESC]
      isAdult: false
      format_in: [TV, TV_SHORT, MOVIE, ONA, OVA]
      status_not_in: [NOT_YET_RELEASED, CANCELLED]
    ) {
      id
      title {
        romaji
        english
        native
        userPreferred
      }
      synonyms
      season
      seasonYear
      startDate { year }
      episodes
      duration
      genres
      tags { name rank isGeneralSpoiler }
      popularity
      averageScore
      description(asHtml: false)
      status
      format
      coverImage { extraLarge large medium color }
      bannerImage
      isAdult
      relations { edges { relationType } }
    }
  }
}
"""

SEASONAL_POPULAR_QUERY = """
query SeasonalPopular($page: Int!, $perPage: Int!, $season: MediaSeason!, $seasonYear: Int!) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      total
      currentPage
      hasNextPage
    }
    media(
      type: ANIME
      sort: [POPULARITY_DESC, SCORE_DESC]
      isAdult: false
      format_in: [TV, TV_SHORT, MOVIE, ONA, OVA]
      status_not_in: [NOT_YET_RELEASED, CANCELLED]
      season: $season
      seasonYear: $seasonYear
    ) {
      id
      title {
        romaji
        english
        native
        userPreferred
      }
      synonyms
      season
      seasonYear
      startDate { year }
      episodes
      duration
      genres
      tags { name rank isGeneralSpoiler }
      popularity
      averageScore
      description(asHtml: false)
      status
      format
      coverImage { extraLarge large medium color }
      bannerImage
      isAdult
      relations { edges { relationType } }
    }
  }
}
"""

SEARCH_MEDIA_QUERY = """
query SearchMedia($search: String!, $perPage: Int!) {
  Page(page: 1, perPage: $perPage) {
    media(
      search: $search
      type: ANIME
      isAdult: false
      sort: [SEARCH_MATCH, POPULARITY_DESC]
    ) {
      id
      title {
        romaji
        english
        native
        userPreferred
      }
    }
  }
}
"""

MEDIA_DETAILS_QUERY = """
query MediaDetails($id: Int!) {
  Media(id: $id, type: ANIME) {
%s
  }
}
""" % MEDIA_DETAIL_FIELDS

MEDIA_DETAILS_BATCH_QUERY = """
query MediaDetailsBatch($ids: [Int], $perPage: Int!) {
  Page(page: 1, perPage: $perPage) {
    media(id_in: $ids, type: ANIME) {
%s
    }
  }
}
""" % MEDIA_DETAIL_FIELDS

USER_LISTS_QUERY = """
query UserMediaLists($userId: Int!) {
  MediaListCollection(userId: $userId, type: ANIME) {
    lists {
      name
      status
      entries {
        status
        score
        progress
        updatedAt
        media {
          id
          title { romaji english native userPreferred }
          seasonYear
          genres
          popularity
          coverImage { large }
          isAdult
        }
      }
    }
  }
}
"""


class AniListRateLimited(AniListError):
    """AniList is rate limiting us and the wait exceeds the caller's budget."""

    def __init__(self, retry_after: float) -> None:
        super().__init__(f"AniList rate limit; retry after {retry_after:.0f}s")
        self.retry_after = retry_after


# AniList limits requests per IP per rolling minute (90 normally, 30 while
# degraded) and answers an overrun with HTTP 429 plus a timeout, so requests
# are paced client side from the X-RateLimit-* headers instead of discovering
# the limit by tripping it.
RATE_WINDOW_SECONDS = 60.0
DEFAULT_RATE_LIMIT = 30  # assume the degraded limit until AniList reports one
MAX_ATTEMPTS = 3
# Longest a request waits for the rate limit before failing. Interactive
# requests keep the default; batch jobs raise it with `rate_limit_patience`.
INTERACTIVE_WAIT_SECONDS = 4.0

_wait_budget: ContextVar[float] = ContextVar("anilist_wait_budget", default=INTERACTIVE_WAIT_SECONDS)


@contextmanager
def rate_limit_patience(max_wait_seconds: float) -> Iterator[None]:
    """Let AniList calls inside this block wait up to `max_wait_seconds` per call."""
    token = _wait_budget.set(max(0.0, max_wait_seconds))
    try:
        yield
    finally:
        _wait_budget.reset(token)


@dataclass
class _RateGate:
    limit: int = DEFAULT_RATE_LIMIT
    remaining: Optional[int] = None
    remaining_reset_at: float = 0.0
    blocked_until: float = 0.0
    sent: Deque[float] = field(default_factory=deque)

    def _prune(self, now: float) -> None:
        while self.sent and self.sent[0] <= now - RATE_WINDOW_SECONDS:
            self.sent.popleft()

    def delay(self, now: float) -> float:
        """Seconds until a request may be sent without overrunning the limit."""
        self._prune(now)
        if self.remaining is not None and now >= self.remaining_reset_at:
            self.remaining = None
        wait = max(0.0, self.blocked_until - now)
        window_wait = self.sent[0] + RATE_WINDOW_SECONDS - now if self.sent else RATE_WINDOW_SECONDS
        if len(self.sent) >= max(1, self.limit - 1):
            wait = max(wait, window_wait)
        if self.remaining is not None and self.remaining <= 0:
            # Other clients (or workers) on this IP spent the budget.
            wait = max(wait, self.remaining_reset_at - now)
        return wait

    def record_send(self, now: float) -> None:
        self.sent.append(now)
        if self.remaining is not None:
            self.remaining -= 1

    def observe(self, status: int, headers: httpx.Headers, now: float) -> Optional[float]:
        """Update from response headers; return the retry delay for a 429."""
        limit = _int_header(headers, "X-RateLimit-Limit")
        if limit and limit > 0:
            self.limit = limit
        remaining = _int_header(headers, "X-RateLimit-Remaining")
        if remaining is not None:
            self.remaining = remaining
            reset_at = _float_header(headers, "X-RateLimit-Reset")
            reset_wait = max(0.0, reset_at - time.time()) if reset_at is not None else RATE_WINDOW_SECONDS
            self.remaining_reset_at = now + reset_wait
        if status != 429:
            return None
        retry_after = _float_header(headers, "Retry-After")
        if retry_after is None:
            reset_at = _float_header(headers, "X-RateLimit-Reset")
            if reset_at is not None:
                retry_after = reset_at - time.time()
        if retry_after is None or retry_after < 0:
            retry_after = RATE_WINDOW_SECONDS
        self.blocked_until = max(self.blocked_until, now + retry_after)
        # Retry-After says when the budget is back; the next response reports it.
        self.remaining = None
        return retry_after


def _int_header(headers: httpx.Headers, name: str) -> Optional[int]:
    value = _float_header(headers, name)
    return int(value) if value is not None else None


def _float_header(headers: httpx.Headers, name: str) -> Optional[float]:
    raw = headers.get(name)
    if raw is None:
        return None
    try:
        return float(raw)
    except ValueError:
        return None


_gate = _RateGate()
_inflight: Dict[Tuple[str, str], "asyncio.Future[Dict[str, Any]]"] = {}


def reset_rate_state() -> None:
    """Forget pacing state (tests, or after a long idle period)."""
    global _gate
    _gate = _RateGate()
    _inflight.clear()


async def _send(body: Dict[str, Any], headers: Dict[str, str]) -> httpx.Response:
    async with httpx.AsyncClient(timeout=20.0) as client:
        return await client.post(ANILIST_GQL, json=body, headers=headers)


async def _wait_for_slot(deadline: float) -> None:
    while True:
        now = time.monotonic()
        wait = _gate.delay(now)
        if wait <= 0:
            # Checked and recorded without an await in between, so concurrent
            # callers cannot both take the last slot.
            _gate.record_send(now)
            return
        if now + wait > deadline:
            raise AniListRateLimited(wait)
        await asyncio.sleep(wait)


async def _perform_request(query: str, variables: Dict[str, Any], token: str | None) -> Dict[str, Any]:
    headers: Dict[str, str] = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    deadline = time.monotonic() + _wait_budget.get()
    for attempt in range(MAX_ATTEMPTS):
        await _wait_for_slot(deadline)
        response = await _send({"query": query, "variables": variables}, headers)
        retry_after = _gate.observe(response.status_code, response.headers, time.monotonic())
        if retry_after is not None:
            if attempt + 1 < MAX_ATTEMPTS and time.monotonic() + retry_after <= deadline:
                continue  # _wait_for_slot sleeps until the block lifts
            raise AniListRateLimited(retry_after)
        response.raise_for_status()
        payload = response.json()
        if "errors" in payload:
            raise AniListError(payload["errors"])
        return payload["data"]
    raise AniListRateLimited(RATE_WINDOW_SECONDS)  # pragma: no cover - loop always returns or raises


async def gql_request(query: str, variables: Dict[str, Any], token: str | None = None) -> Dict[str, Any]:
    """POST a query to AniList, pacing for its rate limit.

    Identical anonymous requests already in flight share one upstream call.
    A 429 is retried after `Retry-After` while the wait fits the caller's
    budget (see `rate_limit_patience`); otherwise `AniListRateLimited` is raised.
    """
    if token:
        return await _perform_request(query, variables, token)
    key = (query, json.dumps(variables, sort_keys=True, default=str))
    pending = _inflight.get(key)
    if pending is not None and not pending.done() and pending.get_loop() is asyncio.get_running_loop():
        return await asyncio.shield(pending)
    task = asyncio.ensure_future(_perform_request(query, variables, token))
    _inflight[key] = task

    def _forget(_: "asyncio.Future[Dict[str, Any]]") -> None:
        if _inflight.get(key) is task:
            del _inflight[key]

    task.add_done_callback(_forget)
    return await asyncio.shield(task)


async def search_media(query: str, *, limit: int = 10, token: str | None = None) -> List[MediaTitlePair]:
    search_term = query.strip()
    if not search_term:
        return []
    per_page = max(1, min(limit, 20))
    data = await gql_request(
        SEARCH_MEDIA_QUERY,
        {"search": search_term, "perPage": per_page},
        token=token,
    )
    media = data.get("Page", {}).get("media", [])
    return [MediaTitlePair.model_validate(item) for item in media]


async def fetch_popular_page(page: int, per_page: int) -> Dict[str, Any]:
    data = await gql_request(POPULAR_POOL_QUERY, {"page": page, "perPage": per_page})
    return data["Page"]


async def fetch_popular_pool(per_page: int = MAX_PER_PAGE, pages: int = 2) -> List[Media]:
    """Most popular anime, `pages` pages deep, each item a full details record.

    AniList caps `perPage` at 50 (a request for 100 silently returns 50 with
    50-item page offsets), so larger values are clamped to the same result.
    """
    per_page = max(1, min(per_page, MAX_PER_PAGE))
    media: List[Media] = []
    current_page = 1
    while current_page <= pages:
        page_payload = await fetch_popular_page(current_page, per_page)
        media.extend(Media.model_validate(m) for m in page_payload["media"])
        if not page_payload["pageInfo"]["hasNextPage"]:
            break
        current_page += 1
    return media


def _clamp_per_page(value: int, default: int) -> int:
    if value <= 0:
        return default
    return max(1, min(value, 100))


def _resolve_season(target_day: date) -> tuple[str, int]:
    month = target_day.month
    if month in (1, 2, 3):
        return "WINTER", target_day.year
    if month in (4, 5, 6):
        return "SPRING", target_day.year
    if month in (7, 8, 9):
        return "SUMMER", target_day.year
    return "FALL", target_day.year


async def _fetch_media_slice(query: str, variables: Dict[str, Any]) -> List[Media]:
    payload = await gql_request(query, variables)
    media_payload = payload.get("Page", {}).get("media", [])
    return [Media.model_validate(item) for item in media_payload]


_CHARACTER_ROLE_WEIGHTS: Dict[str, int] = {
    "PROTAGONIST": 5,
    "MAIN": 5,
    "LEAD": 4,
    "SUPPORTING": 3,
    "SECONDARY": 3,
    "ANTAGONIST": 3,
    "BACKGROUND": 1,
}

_DIFFICULTY_THRESHOLDS: Dict[int, Sequence[int]] = {
    1: (4, 3, 0),
    2: (3, 2, 0),
    3: (2, 1, 0),
}


def _character_role_weight(role: Optional[str]) -> int:
    if not role:
        return 0
    normalized = role.replace("_", " ").strip().upper()
    if not normalized:
        return 0
    return _CHARACTER_ROLE_WEIGHTS.get(normalized, 0)


def _popularity_band(popularity: Optional[int]) -> str:
    if popularity is None:
        return "unknown"
    if popularity >= 150_000:
        return "blockbuster"
    if popularity >= 75_000:
        return "popular"
    if popularity >= 25_000:
        return "cult"
    return "niche"


def _count_edges_with_weight(edges: Sequence[MediaCharacterEdge], threshold: int) -> int:
    total = 0
    for edge in edges:
        if _character_role_weight(edge.role) >= threshold:
            total += 1
    return total


def available_character_edges(media: Media) -> List[MediaCharacterEdge]:
    if not media.characters or not media.characters.edges:
        return []
    edges: List[MediaCharacterEdge] = []
    seen: Set[int] = set()
    for edge in media.characters.edges:
        if not edge or not edge.node:
            continue
        character_id = edge.node.id
        if character_id in seen:
            continue
        image = edge.node.image
        if not image:
            continue
        if not (image.large or image.medium):
            continue
        seen.add(character_id)
        edges.append(edge)
    edges.sort(key=lambda item: item.node.id)
    return edges


def _effective_difficulty(
    requested: int,
    popularity_band: str,
    edges: Sequence[MediaCharacterEdge],
) -> int:
    tier = max(1, min(requested, 3))
    if popularity_band == "niche" and tier == 1:
        return 2
    if popularity_band in {"niche", "cult"} and tier == 2:
        if _count_edges_with_weight(edges, 3) < 4:
            return 3
    if tier == 1 and _count_edges_with_weight(edges, 4) < 4:
        return 2
    return tier


def character_edges_for_tier(
    media: Media,
    *,
    difficulty: int,
    max_candidates: int = 16,
    exclude_ids: Optional[Set[int]] = None,
) -> List[MediaCharacterEdge]:
    edges = available_character_edges(media)
    if exclude_ids:
        edges = [edge for edge in edges if edge.node.id not in exclude_ids]
    if not edges:
        return []

    band = _popularity_band(media.popularity)
    tier = _effective_difficulty(difficulty, band, edges)
    thresholds = _DIFFICULTY_THRESHOLDS.get(tier, (0,))

    weighted = sorted(
        edges,
        key=lambda edge: (-_character_role_weight(edge.role), edge.node.id),
    )

    results: List[MediaCharacterEdge] = []
    seen: Set[int] = set()
    for threshold in thresholds:
        for edge in weighted:
            character_id = edge.node.id
            if character_id in seen:
                continue
            if _character_role_weight(edge.role) < threshold:
                continue
            results.append(edge)
            seen.add(character_id)
            if len(results) >= max_candidates:
                return results

    if len(results) < max_candidates:
        for edge in weighted:
            character_id = edge.node.id
            if character_id in seen:
                continue
            results.append(edge)
            seen.add(character_id)
            if len(results) >= max_candidates:
                break

    return results


async def fetch_opening_pool(
    cache: CacheBackend,
    *,
    day: date | None = None,
    top_rated_limit: int = 25,
    top_popular_limit: int = 50,
    seasonal_limit: int = 25,
    ttl: int = 86_400,
) -> List[Media]:
    target_day = day or datetime.now(timezone.utc).date()
    top_rated_per_page = _clamp_per_page(top_rated_limit, 25)
    top_popular_per_page = _clamp_per_page(top_popular_limit, 50)
    seasonal_per_page = _clamp_per_page(seasonal_limit, 25)

    season, season_year = _resolve_season(target_day)
    cache_key = (
        f"anilist:opening:v2:{target_day.isoformat()}"
        f":{top_rated_per_page}:{top_popular_per_page}:{seasonal_per_page}"
    )

    async def creator() -> List[dict]:
        top_rated_task = _fetch_media_slice(
            TOP_RATED_QUERY, {"page": 1, "perPage": top_rated_per_page}
        )
        top_popular_task = _fetch_media_slice(
            TOP_POPULAR_QUERY, {"page": 1, "perPage": top_popular_per_page}
        )
        seasonal_task = _fetch_media_slice(
            SEASONAL_POPULAR_QUERY,
            {
                "page": 1,
                "perPage": seasonal_per_page,
                "season": season,
                "seasonYear": season_year,
            },
        )
        top_rated, top_popular, seasonal = await asyncio.gather(
            top_rated_task, top_popular_task, seasonal_task
        )
        combined: List[Media] = []
        seen: set[int] = set()
        for bucket in (top_rated, top_popular, seasonal):
            for media in bucket:
                if media.id in seen:
                    continue
                seen.add(media.id)
                combined.append(media)
        return [media.model_dump(mode="json") for media in combined]

    raw_media = await cache.remember(cache_key, ttl, creator)
    return [Media.model_validate(item) for item in raw_media]


async def fetch_media_details(media_id: int) -> Media:
    data = await gql_request(MEDIA_DETAILS_QUERY, {"id": media_id})
    return Media.model_validate(data["Media"])


async def fetch_media_details_batch(media_ids: Sequence[int]) -> Dict[int, Media]:
    """Details for many ids, one request per 50. Unknown ids are absent from the result."""
    unique: List[int] = list(dict.fromkeys(int(media_id) for media_id in media_ids))
    found: Dict[int, Media] = {}
    for start in range(0, len(unique), MAX_PER_PAGE):
        chunk = unique[start : start + MAX_PER_PAGE]
        data = await gql_request(MEDIA_DETAILS_BATCH_QUERY, {"ids": chunk, "perPage": len(chunk)})
        for item in (data.get("Page") or {}).get("media") or []:
            media = Media.model_validate(item)
            found[media.id] = media
    return found


async def fetch_media_bulk(media_ids: Sequence[int]) -> List[Media]:
    found = await fetch_media_details_batch(media_ids)
    return [found[media_id] for media_id in media_ids if media_id in found]


async def fetch_user_media_lists(user_id: int, token: str) -> MediaListCollection:
    data = await gql_request(USER_LISTS_QUERY, {"userId": user_id}, token=token)
    return MediaListCollection.model_validate(data["MediaListCollection"])


async def fetch_viewer(token: str) -> Dict[str, Any]:
    """Resolve identity through AniList GraphQL, not the OAuth token response."""
    data = await gql_request(VIEWER_QUERY, {}, token=token)
    viewer = data.get("Viewer")
    if not isinstance(viewer, dict) or not viewer.get("id"):
        raise AniListError("Authenticated viewer is unavailable")
    return viewer


async def exchange_code_for_token(
    *,
    code: str,
    client_id: str,
    client_secret: str,
    redirect_uri: str,
) -> TokenResponse:
    payload = {
        "grant_type": "authorization_code",
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "code": code,
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(f"{ANILIST_AUTH_BASE}/token", json=payload)
        response.raise_for_status()
        return TokenResponse.model_validate(response.json())


async def refresh_access_token(
    *,
    refresh_token: str,
    client_id: str,
    client_secret: str,
) -> TokenResponse:
    payload = {
        "grant_type": "refresh_token",
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(f"{ANILIST_AUTH_BASE}/token", json=payload)
        response.raise_for_status()
        return TokenResponse.model_validate(response.json())
