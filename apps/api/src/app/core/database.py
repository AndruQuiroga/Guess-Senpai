from __future__ import annotations

import logging
from pathlib import Path
from typing import AsyncGenerator, Optional

from fastapi import FastAPI
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from alembic import command
from alembic.config import Config

from .config import settings

_engine: Optional[AsyncEngine] = None
_session_factory: Optional[async_sessionmaker[AsyncSession]] = None
_migrations_ran = False

logger = logging.getLogger(__name__)

_BASE_DIR = Path(__file__).resolve().parents[3]


def _resolve_project_path(path_value: str) -> Path:
    path = Path(path_value)
    if path.is_absolute():
        return path
    return _BASE_DIR / path


def _get_alembic_config() -> Config:
    config = Config(str(_resolve_project_path(settings.alembic_ini_path)))
    config.set_main_option("script_location", str(_resolve_project_path(settings.alembic_migrations_path)))

    sync_database_url = settings.database_url.replace("+asyncpg", "")
    config.set_main_option("sqlalchemy.url", sync_database_url)
    return config


def run_migrations() -> None:
    global _migrations_ran
    if _migrations_ran:
        return

    try:
        config = _get_alembic_config()
        command.upgrade(config, "head")
        _migrations_ran = True
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.exception("Failed to run database migrations: %s", exc)
        raise


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
    run_migrations()
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
