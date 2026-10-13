from __future__ import annotations

from fastapi import APIRouter, HTTPException
from sqlalchemy import text
from redis.asyncio import Redis

from ..core.config import settings
from ..core.database import get_engine


router = APIRouter()


@router.get("/live", response_model=dict)
async def live() -> dict:
    return {"ok": True}


@router.get("/ready", response_model=dict)
async def ready() -> dict:
    try:
        async with get_engine().connect() as connection:
            await connection.execute(text("SELECT 1"))
        if settings.redis_url:
            client = Redis.from_url(settings.redis_url, socket_connect_timeout=2, socket_timeout=2)
            try:
                await client.ping()
            finally:
                await client.aclose()
    except Exception:
        raise HTTPException(status_code=503, detail="Service dependencies unavailable") from None
    return {"ok": True}
