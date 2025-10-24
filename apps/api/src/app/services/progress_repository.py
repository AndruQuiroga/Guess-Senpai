from __future__ import annotations

from datetime import date
from typing import Dict, List, Optional

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import models


async def get_daily_progress(
    session: AsyncSession, user_id: int, puzzle_date: date
) -> Optional[models.DailyProgress]:
    return await session.get(models.DailyProgress, (user_id, puzzle_date))


async def upsert_daily_progress(
    session: AsyncSession,
    user_id: int,
    puzzle_date: date,
    progress: Dict[str, Dict[str, object]],
) -> models.DailyProgress:
    record = await get_daily_progress(session, user_id, puzzle_date)
    if record is None:
        record = models.DailyProgress(
            user_id=user_id,
            puzzle_date=puzzle_date,
            progress=dict(progress),
        )
        session.add(record)
    else:
        record.progress = dict(progress)
    return record


async def delete_daily_progress(session: AsyncSession, user_id: int, puzzle_date: date) -> None:
    await session.execute(
        delete(models.DailyProgress)
        .where(models.DailyProgress.user_id == user_id)
        .where(models.DailyProgress.puzzle_date == puzzle_date)
    )


async def list_daily_progress(
    session: AsyncSession,
    user_id: int,
    limit: Optional[int] = None,
    descending: bool = True,
) -> List[models.DailyProgress]:
    order_clause = (
        models.DailyProgress.puzzle_date.desc()
        if descending
        else models.DailyProgress.puzzle_date.asc()
    )
    stmt = (
        select(models.DailyProgress)
        .where(models.DailyProgress.user_id == user_id)
        .order_by(order_clause)
    )
    if limit is not None and limit > 0:
        stmt = stmt.limit(limit)
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_streak(session: AsyncSession, user_id: int) -> Optional[models.Streak]:
    return await session.get(models.Streak, user_id)


async def upsert_streak(
    session: AsyncSession,
    user_id: int,
    count: int,
    last_completed: Optional[date],
) -> models.Streak:
    record = await get_streak(session, user_id)
    if record is None:
        record = models.Streak(user_id=user_id, count=count, last_completed=last_completed)
        session.add(record)
    else:
        record.count = count
        record.last_completed = last_completed
    return record


async def delete_streak(session: AsyncSession, user_id: int) -> None:
    await session.execute(delete(models.Streak).where(models.Streak.user_id == user_id))
