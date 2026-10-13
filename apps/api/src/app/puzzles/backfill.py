"""Publish missing daily sets for past days so the archive has something to play.

    python -m app.puzzles.backfill --days 14
    python -m app.puzzles.backfill --days 14 --republish-legacy

Only days without a published set are generated; current-format sets are never
touched. With --republish-legacy, sets stored in an older format (today
included) are regenerated in the current round format; progress recorded
against the old set is left behind with it. Past days are generated from
today's popularity data (the historical ranking is not kept), seeded by their
own date, so each day still differs.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional

from ..core.config import settings
from ..core.database import get_session_factory
from ..db.models import DailyPuzzleSet
from ..services import anilist
from . import engine

logger = logging.getLogger(__name__)


async def missing_days(
    days: int,
    today: Optional[date] = None,
    *,
    include_legacy: bool = False,
) -> List[date]:
    """Days to (re)publish, oldest first.

    Past days without a set; with `include_legacy`, also any day in the
    window (today included) whose set uses an older rules version.
    """
    today = today or datetime.now(timezone.utc).date()
    wanted = [today - timedelta(days=offset) for offset in range(days, 0, -1)]
    if include_legacy:
        wanted.append(today)
    session_factory = get_session_factory()
    result: List[date] = []
    async with session_factory() as session:
        for day in wanted:
            row = await session.get(DailyPuzzleSet, day)
            if row is None:
                if day < today:
                    result.append(day)
            elif include_legacy and row.rules_version != engine.CURRENT_RULES_VERSION:
                result.append(day)
    return result


async def backfill(
    days: int,
    *,
    today: Optional[date] = None,
    pause_seconds: float = 5.0,
    retries: int = 4,
    retry_wait_seconds: float = 90.0,
    rate_limit_wait_seconds: float = 120.0,
    republish_legacy: bool = False,
) -> List[date]:
    """Publish each missing day, pausing between days and retrying failures.

    AniList data comes from one shared popularity fetch per run (the pool
    carries full details), so extra days cost almost no AniList requests.
    Calls made here may wait out AniList's rate limit for up to
    `rate_limit_wait_seconds` instead of failing; the short pause between days
    spaces out AnimeThemes lookups, and a failed day still retries.
    """
    published: List[date] = []
    for index, day in enumerate(await missing_days(days, today, include_legacy=republish_legacy)):
        if index and pause_seconds:
            await asyncio.sleep(pause_seconds)
        for attempt in range(retries + 1):
            try:
                with anilist.rate_limit_patience(rate_limit_wait_seconds):
                    await engine.publish_daily_puzzle(
                        day,
                        include_guess_opening=settings.animethemes_enabled,
                        replace_legacy=republish_legacy,
                    )
            except Exception:
                logger.warning("Publishing %s failed (attempt %d)", day, attempt + 1, exc_info=True)
                if attempt < retries:
                    await asyncio.sleep(retry_wait_seconds)
                continue
            published.append(day)
            logger.info("Published %s", day)
            break
        else:
            logger.error("Giving up on %s", day)
    return published


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--days", type=int, default=14, help="How many past days to fill (default 14)")
    parser.add_argument(
        "--republish-legacy",
        action="store_true",
        help="Also regenerate older-format sets in the window (today included) in the current format",
    )
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    published = asyncio.run(backfill(max(0, args.days), republish_legacy=args.republish_legacy))
    print(f"Published {len(published)} day(s): {', '.join(day.isoformat() for day in published) or 'none'}")


if __name__ == "__main__":
    main()
