from __future__ import annotations

import asyncio
from datetime import date
from typing import Any, Dict, List, Optional, Sequence

import httpx
from pydantic import BaseModel, Field

from .cache import CacheBackend

ANILIST_GQL = "https://graphql.anilist.co"
ANILIST_AUTH_BASE = "https://anilist.co/api/v2/oauth"


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
    user: Optional[Dict[str, Any]] = None


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
    }
  }
}
"""

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
  }
}
"""

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


async def gql_request(query: str, variables: Dict[str, Any], token: str | None = None) -> Dict[str, Any]:
    headers: Dict[str, str] = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(
            ANILIST_GQL,
            json={"query": query, "variables": variables},
            headers=headers,
        )
        response.raise_for_status()
        payload = response.json()
        if "errors" in payload:
            raise AniListError(payload["errors"])
        return payload["data"]


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


async def fetch_popular_pool(per_page: int = 100, pages: int = 2) -> List[Media]:
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


async def fetch_opening_pool(
    cache: CacheBackend,
    *,
    day: date | None = None,
    top_rated_limit: int = 25,
    top_popular_limit: int = 50,
    seasonal_limit: int = 25,
    ttl: int = 86_400,
) -> List[Media]:
    target_day = day or date.today()
    top_rated_per_page = _clamp_per_page(top_rated_limit, 25)
    top_popular_per_page = _clamp_per_page(top_popular_limit, 50)
    seasonal_per_page = _clamp_per_page(seasonal_limit, 25)

    season, season_year = _resolve_season(target_day)
    cache_key = (
        f"anilist:opening:{target_day.isoformat()}"
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


async def fetch_media_bulk(media_ids: Sequence[int]) -> List[Media]:
    return [await fetch_media_details(media_id) for media_id in media_ids]


async def fetch_user_media_lists(user_id: int, token: str) -> MediaListCollection:
    data = await gql_request(USER_LISTS_QUERY, {"userId": user_id}, token=token)
    return MediaListCollection.model_validate(data["MediaListCollection"])


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
