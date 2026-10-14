"""Conservative numbered-season metadata using already-fetched AniList data."""

from __future__ import annotations

import re
from typing import Sequence

from .anilist import Media

_SEASON = re.compile(
    r"\b(?:season\s+(\d{1,2})|(\d{1,2})(?:st|nd|rd|th)\s+season)\b", re.I
)
_ROMAN = re.compile(r"\s+(II|III|IV|V|VI|VII|VIII|IX|X)\s*$")
_ROMAN_NUMBERS = {
    "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6,
    "VII": 7, "VIII": 8, "IX": 9, "X": 10,
}
_PART = re.compile(r"\b(?:part|cour)\s*\d|\bfinal\s+season\b", re.I)


def media_titles(media: Media) -> list[str]:
    values = (
        media.title.english, media.title.romaji,
        media.title.userPreferred, media.title.native,
    )
    return list(dict.fromkeys(value for value in values if value))


def season_number(media: Media) -> int | None:
    """Never mistake an OP number, release year or split cour for a season.

    Explicit season labels take precedence. Unnumbered sequels and ambiguous
    parts stay unknown; short TV series without a prequel start at season one.
    No extra AniList lookups or guessed counts of prequel entries are needed.
    """
    if media.format not in {"TV", "TV_SHORT", "ONA"}:
        return None
    titles = media_titles(media)
    numbers = set()
    for title in titles:
        match = _SEASON.search(title)
        if match:
            numbers.add(int(match.group(1) or match.group(2)))
        elif (match := _ROMAN.search(title)) is not None:
            numbers.add(_ROMAN_NUMBERS[match.group(1)])
    if numbers:
        return next(iter(numbers)) if len(numbers) == 1 and min(numbers) > 0 else None
    if any(_PART.search(title) for title in titles):
        return None
    if media.relations is None:
        return None
    edges = (media.relations or {}).get("edges") or []
    if any(edge.get("relationType") in {"PREQUEL", "PARENT"} for edge in edges):
        return None
    return 1 if media.episodes is not None and 0 < media.episodes <= 52 else None


def series_groups(pool: Sequence[Media]) -> dict[int, set[int]]:
    """Connected prequel/sequel anime share an exclusion group, without I/O."""
    parents: dict[int, int] = {}

    def root(value: int) -> int:
        parents.setdefault(value, value)
        while parents[value] != value:
            parents[value] = parents[parents[value]]
            value = parents[value]
        return value

    for media in pool:
        root(media.id)
        for edge in (media.relations or {}).get("edges") or []:
            node = edge.get("node") or {}
            if (
                edge.get("relationType") in {"PREQUEL", "SEQUEL"}
                and node.get("type") == "ANIME"
                and node.get("id")
            ):
                parents[root(int(node["id"]))] = root(media.id)
    groups: dict[int, set[int]] = {}
    for media_id in parents:
        groups.setdefault(root(media_id), set()).add(media_id)
    return {media_id: groups[root(media_id)] for media_id in parents}


def season_options(
    media: Media, pool: Sequence[Media], groups: dict[int, set[int]]
) -> list[int]:
    """Offer a numbered-season question only for a known multi-season series.

    A numbered second/third season establishes the lower season numbers.
    Movies/specials, a sole season one, and ambiguous unnumbered follow-ups
    never manufacture a bonus question. Already-fetched entries suffice.
    """
    target = season_number(media)
    if target is None:
        return []
    family = groups.get(media.id, {media.id})
    known = [
        season_number(item) or 0 for item in pool
        if item.id in family and item.status not in {"NOT_YET_RELEASED", "CANCELLED"}
    ]
    latest = max(known, default=0)
    return list(range(1, latest + 1)) if latest > 1 and target <= latest else []


def series_titles(
    media: Media, pool: Sequence[Media], groups: dict[int, set[int]]
) -> list[str]:
    """Accept the series name separately from its numbered-season bonus."""
    family = groups.get(media.id, {media.id})
    titles = [title for item in pool if item.id in family for title in media_titles(item)]
    titles.extend(media_titles(media))
    # Explicit numbering may be present even when the prequel is outside the pool.
    for title in list(titles):
        match = _SEASON.search(title) or _ROMAN.search(title)
        if match:
            base = title[:match.start()].strip(" :,-")
            if base:
                titles.append(base)
    return list(dict.fromkeys(titles))
