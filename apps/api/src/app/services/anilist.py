from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence

import httpx
from pydantic import BaseModel, Field

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
