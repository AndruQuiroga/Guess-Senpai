from __future__ import annotations

from typing import AsyncGenerator, Optional

from fastapi import FastAPI
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from .config import settings

_engine: Optional[AsyncEngine] = None
_session_factory: Optional[async_sessionmaker[AsyncSession]] = None


def get_engine() -> AsyncEngine:
    global _engine, _session_factory
    if _engine is None:
        _engine = create_async_engine(settings.database_url, future=True, pool_pre_ping=True)
        _session_factory = async_sessionmaker(_engine, expire_on_commit=False)
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    if _session_factory is None:
        get_engine()
    assert _session_factory is not None
    return _session_factory


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def connect_database() -> None:
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.execute(text("SELECT 1"))


async def disconnect_database() -> None:
    global _engine, _session_factory
    _session_factory = None
    if _engine is not None:
        await _engine.dispose()
        _engine = None


def register_database(app: FastAPI) -> None:
    @app.on_event("startup")
    async def _startup() -> None:
        await connect_database()

    @app.on_event("shutdown")
    async def _shutdown() -> None:
        await disconnect_database()
