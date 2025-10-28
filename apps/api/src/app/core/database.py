from __future__ import annotations

import asyncio
import logging
from typing import AsyncGenerator, Optional

from fastapi import FastAPI
from sqlalchemy import text
from sqlalchemy.exc import OperationalError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from ..db.models import Base
from .config import settings

logger = logging.getLogger(__name__)

_engine: Optional[AsyncEngine] = None
_session_factory: Optional[async_sessionmaker[AsyncSession]] = None


def get_engine() -> AsyncEngine:
    """Return a singleton async engine configured for the application."""

    global _engine, _session_factory

    if _engine is None:
        _engine = create_async_engine(
            settings.database_url,
            pool_pre_ping=True,
            future=True,
            echo=settings.database_echo,
        )
        _session_factory = async_sessionmaker(_engine, expire_on_commit=False)

    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """Return an async session factory backed by the application engine."""

    if _session_factory is None:
        get_engine()

    assert _session_factory is not None
    return _session_factory


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields a managed database session."""

    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:  # pragma: no cover - defensive rollback
            await session.rollback()
            raise


async def _ping_database(engine: AsyncEngine) -> None:
    async with engine.connect() as connection:
        await connection.execute(text("SELECT 1"))


async def _create_schema(engine: AsyncEngine) -> None:
    async with engine.begin() as connection:
        await connection.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
        await connection.run_sync(Base.metadata.create_all)


async def connect_database() -> None:
    """Initialise the database engine and ensure the schema exists.

    When the service starts inside Docker the database container may take a few
    seconds to become ready.  We therefore retry the connection a configurable
    number of times before giving up.
    """

    engine = get_engine()

    attempts = max(1, settings.database_connect_retries)
    delay = max(0.0, settings.database_connect_retry_interval_seconds)

    last_error: Optional[BaseException] = None

    for attempt in range(1, attempts + 1):
        try:
            await _ping_database(engine)
            await _create_schema(engine)
        except OperationalError as exc:
            last_error = exc
            logger.warning(
                "Database connection attempt %s/%s failed: %s", attempt, attempts, exc
            )
            if attempt < attempts:
                await asyncio.sleep(delay)
            continue
        except SQLAlchemyError as exc:
            # Non-operational SQLAlchemy errors are considered unrecoverable.
            logger.exception("Database initialisation failed: %s", exc)
            raise
        else:
            logger.info("Database initialised on attempt %s", attempt)
            return

    message = "Could not connect to the database after multiple attempts"
    logger.error(message)
    raise RuntimeError(message) from last_error


async def disconnect_database() -> None:
    """Dispose of the engine and session factory."""

    global _engine, _session_factory

    _session_factory = None
    if _engine is not None:
        await _engine.dispose()
        _engine = None


def register_database(app: FastAPI) -> None:
    """Register FastAPI startup/shutdown hooks for database management."""

    @app.on_event("startup")
    async def _startup() -> None:  # pragma: no cover - FastAPI integration
        await connect_database()

    @app.on_event("shutdown")
    async def _shutdown() -> None:  # pragma: no cover - FastAPI integration
        await disconnect_database()
