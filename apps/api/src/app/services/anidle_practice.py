from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Iterable, Optional, Sequence

from ..core.config import settings
from ..puzzles import engine as puzzle_engine
from ..puzzles.models import AnidlePracticeResponse, AnidlePuzzleBundle
from ..services.anilist import Media

PRACTICE_ID_PREFIX = "practice:"
# How many recent answers a client may ask us to avoid repeating.
MAX_EXCLUDED_IDS = 20


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


async def build_practice_game(excluded_ids: Optional[Iterable[int]] = None) -> AnidlePracticeResponse:
    """Build a fresh Anidle (rules v2) from the same pool and builders the daily uses.

    Reads the popular pool through the shared cache but never touches
    ``DailyPuzzleSet``, progress, streaks or the recent-media history.
    """
    cache = await puzzle_engine._get_cache()
    day = datetime.now(timezone.utc).date()
    popular = await puzzle_engine._load_popular_pool(day, cache, settings)
    pool = puzzle_engine._build_candidate_pool(popular, None, None)
    candidate = pick_practice_media(pool, list(excluded_ids or [])[:MAX_EXCLUDED_IDS])
    media = await puzzle_engine._load_media_details(candidate.id, cache, settings)
    return AnidlePracticeResponse(
        practice_id=new_practice_id(),
        rules_version="2",
        anidle=AnidlePuzzleBundle(
            mediaId=media.id,
            puzzle=puzzle_engine._build_anidle(media),
            solution=puzzle_engine._build_solution(media),
        ),
    )
