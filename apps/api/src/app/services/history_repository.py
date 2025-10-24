from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import models


async def list_recent_media(
    session: AsyncSession,
    user_id: int,
    window_days: int,
    *,
    reference_time: datetime | None = None,
) -> List[int]:
    """Return recent media IDs for a user ordered from most to least recent."""

    window = max(window_days, 0)
    if window == 0:
        return []

    if reference_time is None:
        reference_time = datetime.now(timezone.utc)

    cutoff = reference_time - timedelta(days=window)
    stmt = (
        select(models.UserRecentMedia.media_id)
        .where(models.UserRecentMedia.user_id == user_id)
        .where(models.UserRecentMedia.seen_at >= cutoff)
        .order_by(models.UserRecentMedia.seen_at.desc())
        .limit(window)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def record_recent_media(
    session: AsyncSession,
    user_id: int,
    media_id: int,
    window_days: int,
) -> List[int]:
    """Insert or update a recent media entry and prune old rows."""

    window = max(window_days, 0)
    if window == 0:
        await session.execute(
            delete(models.UserRecentMedia).where(models.UserRecentMedia.user_id == user_id)
        )
        await session.flush()
        return []

    now = datetime.now(timezone.utc)
    record = await session.get(models.UserRecentMedia, (user_id, media_id))
    if record is None:
        session.add(models.UserRecentMedia(user_id=user_id, media_id=media_id, seen_at=now))
    else:
        record.seen_at = now

    cutoff = now - timedelta(days=window)
    await session.execute(
        delete(models.UserRecentMedia)
        .where(models.UserRecentMedia.user_id == user_id)
        .where(models.UserRecentMedia.seen_at < cutoff)
    )
    await session.flush()
    return await list_recent_media(session, user_id, window, reference_time=now)
