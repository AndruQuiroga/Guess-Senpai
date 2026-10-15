from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Iterable, List, Literal, Optional, Sequence

from ..core.config import settings
from ..puzzles import engine as puzzle_engine
from ..puzzles.models import AnidlePracticeResponse, AnidlePuzzleBundle
from ..services.anilist import Media, MediaListCollection

PRACTICE_ID_PREFIX = "practice:"
# How many recent answers a client may ask us to avoid repeating.
MAX_EXCLUDED_IDS = 20
# List statuses meaning the player has seen at least some of the show.
# PLANNING is left out: those are anime they have not watched yet.
WATCHED_STATUSES = {"COMPLETED", "CURRENT", "REPEATING", "PAUSED", "DROPPED"}

PracticeSource = Literal["popular", "list"]


class EmptyPracticeList(LookupError):
    """The player's AniList list has no watched anime to practise with."""


def new_practice_id() -> str:
    """Opaque, unguessable label for one practice game (not stored server side)."""
    return f"{PRACTICE_ID_PREFIX}{secrets.token_urlsafe(9)}"


def pick_practice_media(pool: Sequence[Media], excluded_ids: Iterable[int] = ()) -> Media:
    """Uniformly random candidate, skipping recently played answers when possible."""
    if not pool:
        raise ValueError("Candidate pool is empty")
    blocked = set(excluded_ids)
    choices = [media for media in pool if media.id not in blocked] or list(pool)
    return choices[secrets.randbelow(len(choices))]


def watched_media(lists: MediaListCollection) -> List[Media]:
    """Distinct non-adult anime the player has watched, from their AniList lists."""
    seen: set[int] = set()
    watched: List[Media] = []
    for media_list in lists.lists:
        list_status = media_list.status or ""
        for entry in media_list.entries:
            status = (entry.status or list_status).upper()
            media = entry.media
            if status not in WATCHED_STATUSES or media.isAdult or media.id in seen:
                continue
            seen.add(media.id)
            watched.append(media)
    return watched


async def build_practice_game(
    excluded_ids: Optional[Iterable[int]] = None,
    *,
    user: Optional[puzzle_engine.UserContext] = None,
) -> AnidlePracticeResponse:
    """Build a fresh Anidle (rules v2) from the same builders the daily uses.

    Without ``user`` the answer comes from the popular pool; with it, from the
    anime on that player's AniList list. Never touches ``DailyPuzzleSet``,
    progress, streaks or the recent-media history.
    """
    cache = await puzzle_engine._get_cache()
    if user is not None:
        pool = watched_media(await puzzle_engine._fetch_user_lists(cache, user))
        if not pool:
            raise EmptyPracticeList(f"AniList user {user.user_id} has no watched anime")
    else:
        day = datetime.now(timezone.utc).date()
        popular = await puzzle_engine._load_popular_pool(day, cache, settings)
        pool = puzzle_engine._build_candidate_pool(popular, None, None)
    candidate = pick_practice_media(pool, list(excluded_ids or [])[:MAX_EXCLUDED_IDS])
    media = await puzzle_engine._load_media_details(candidate.id, cache, settings)
    return AnidlePracticeResponse(
        practice_id=new_practice_id(),
        rules_version="2",
        source="list" if user is not None else "popular",
        anidle=AnidlePuzzleBundle(
            mediaId=media.id,
            puzzle=puzzle_engine._build_anidle(media),
            solution=puzzle_engine._build_solution(media),
        ),
    )
