from __future__ import annotations

import unicodedata
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence, Tuple

import httpx

BASE_URL = "https://api.animethemes.moe"


class AnimeThemesError(RuntimeError):
    """Raised when the AnimeThemes API returns an error."""


@dataclass
class OpeningClip:
    title: Optional[str]
    sequence: Optional[int]
    audio_url: Optional[str]
    video_url: Optional[str]
    length_seconds: Optional[int]
    song_title: Optional[str]
    artist: Optional[str]


def _normalize(text: str) -> str:
    ascii_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    return ascii_text.lower()


async def _request(
    path: str,
    *,
    params: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=20.0) as client:
        response = await client.get(path, params=params)
        response.raise_for_status()
        return response.json()


async def search_anime(title: str) -> List[Dict[str, Any]]:
    payload = await _request("/search/", params={"q": title})
    return [item for item in payload.get("data", []) if item.get("type") == "anime"]


async def fetch_anime(slug: str) -> Dict[str, Any]:
    includes = "animethemes,animethemes.song,animethemes.entries,animethemes.entries.videos"
    return await _request(f"/anime/{slug}", params={"include": includes})


def _index_included(payload: Dict[str, Any]) -> Dict[Tuple[str, str], Dict[str, Any]]:
    included = payload.get("included", [])
    return {(item["type"], item["id"]): item for item in included if "id" in item}


def _resolve_relationship(
    item: Dict[str, Any],
    relationship_name: str,
    index: Dict[Tuple[str, str], Dict[str, Any]],
) -> List[Dict[str, Any]]:
    relationships = item.get("relationships", {})
    rel = relationships.get(relationship_name)
    if not rel:
        return []
    data = rel.get("data")
    if not data:
        return []
    if isinstance(data, dict):
        resolved = index.get((data["type"], data["id"]))
        return [resolved] if resolved else []
    results: List[Dict[str, Any]] = []
    for ref in data:
        resolved = index.get((ref["type"], ref["id"]))
        if resolved:
            results.append(resolved)
    return results


def _choose_best_video(videos: Sequence[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not videos:
        return None
    # Prioritise audio-only if available, otherwise the smallest resolution webm.
    audio_only = [v for v in videos if v["attributes"].get("audio")]
    if audio_only:
        return audio_only[0]
    sorted_videos = sorted(
        videos,
        key=lambda v: (
            v["attributes"].get("resolution") or 1080,
            v["attributes"].get("filesize") or 0,
        ),
    )
    return sorted_videos[0]


def extract_opening_clip(payload: Dict[str, Any]) -> Optional[OpeningClip]:
    index = _index_included(payload)
    anime = payload.get("data")
    if anime is None:
        return None
    for theme in _resolve_relationship(anime, "animethemes", index):
        if theme["attributes"].get("type") != "OP":
            continue
        entries: List[Dict[str, Any]] = []
        for entry in _resolve_relationship(theme, "animethemeentries", index):
            entries.extend(_resolve_relationship(entry, "videos", index))
        if not entries:
            continue
        best_video = _choose_best_video(entries)
        if not best_video:
            continue
        song = _resolve_relationship(theme, "song", index)
        song_attrs = song[0]["attributes"] if song else {}
        attributes = theme.get("attributes", {})
        video_attrs = best_video.get("attributes", {})
        return OpeningClip(
            title=attributes.get("title"),
            sequence=attributes.get("sequence"),
            audio_url=video_attrs.get("audio"),
            video_url=video_attrs.get("link"),
            length_seconds=video_attrs.get("length"),
            song_title=song_attrs.get("title"),
            artist=", ".join(artist.get("name") for artist in song_attrs.get("artists", [])) if song_attrs else None,
        )
    return None


async def find_opening_clip(titles: Sequence[str]) -> Optional[OpeningClip]:
    """Try to locate an opening clip given multiple title variants."""

    seen: set[str] = set()
    for title in titles:
        if not title:
            continue
        normalized = _normalize(title)
        if normalized in seen:
            continue
        seen.add(normalized)
        search_results = await search_anime(title)
        if not search_results:
            continue
        # Rank by slug similarity then by title match.
        search_results.sort(
            key=lambda item: (
                _normalize(item["attributes"].get("slug", "")) != normalized,
                item["attributes"].get("name") != title,
            )
        )
        slug = search_results[0]["attributes"].get("slug") or search_results[0].get("id")
        if not slug:
            continue
        anime_payload = await fetch_anime(slug)
        clip = extract_opening_clip(anime_payload)
        if clip:
            return clip
    return None
