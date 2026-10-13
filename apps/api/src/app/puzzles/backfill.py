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


async def backfill(days: int, *, today: Optional[date] = None) -> List[date]:
    published: List[date] = []
    for day in await missing_days(days, today):
        try:
            await engine.publish_daily_puzzle(day, include_guess_opening=settings.animethemes_enabled)
        except Exception:
            logger.exception("Failed to publish %s; continuing with the next day", day)
            continue
        published.append(day)
        logger.info("Published %s", day)
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
