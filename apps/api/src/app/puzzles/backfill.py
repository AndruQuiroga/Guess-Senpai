"""Publish missing daily sets for past days so the archive has something to play.

    python -m app.puzzles.backfill --days 14

Only days without a published set are generated; existing sets are never
touched. Past days are generated from today's popularity data (the historical
ranking is not kept), seeded by their own date, so each day still differs.
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
from . import engine

logger = logging.getLogger(__name__)


async def missing_days(days: int, today: Optional[date] = None) -> List[date]:
    """Past days (oldest first, excluding today) that have no published set."""
    today = today or datetime.now(timezone.utc).date()
    wanted = [today - timedelta(days=offset) for offset in range(days, 0, -1)]
    session_factory = get_session_factory()
    async with session_factory() as session:
        return [day for day in wanted if await session.get(DailyPuzzleSet, day) is None]


async def backfill(
    days: int,
    *,
    today: Optional[date] = None,
    pause_seconds: float = 45.0,
    retries: int = 4,
    retry_wait_seconds: float = 90.0,
) -> List[date]:
    """Publish each missing day, pausing between days and retrying failures.

    Every new day needs dozens of AniList lookups; back-to-back days exceed
    AniList's per-minute limit (HTTP 429), so days are spaced out and a failed
    day waits and tries again before moving on.
    """
    published: List[date] = []
    for index, day in enumerate(await missing_days(days, today)):
        if index and pause_seconds:
            await asyncio.sleep(pause_seconds)
        for attempt in range(retries + 1):
            try:
                await engine.publish_daily_puzzle(day, include_guess_opening=settings.animethemes_enabled)
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
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    published = asyncio.run(backfill(max(0, args.days)))
    print(f"Published {len(published)} day(s): {', '.join(day.isoformat() for day in published) or 'none'}")


if __name__ == "__main__":
    main()
