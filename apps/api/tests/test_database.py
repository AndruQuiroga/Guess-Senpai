from __future__ import annotations

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import database


@pytest.mark.asyncio
async def test_engine_singleton(monkeypatch) -> None:
    await database.disconnect_database()
    monkeypatch.setattr(database.settings, "database_url", "sqlite+aiosqlite:///:memory:")

    engine = database.get_engine()
    again = database.get_engine()

    assert engine is again

    await database.disconnect_database()


@pytest.mark.asyncio
async def test_connect_database_creates_tables(monkeypatch) -> None:
    await database.disconnect_database()
    monkeypatch.setattr(database.settings, "database_url", "sqlite+aiosqlite:///:memory:")
    monkeypatch.setattr(database.settings, "database_connect_retries", 1)

    await database.connect_database()

    session_factory = database.get_session_factory()
    async with session_factory() as session:
        assert isinstance(session, AsyncSession)
        result = await session.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
        )
        assert result.scalar_one() == "users"

    await database.disconnect_database()


@pytest.mark.asyncio
async def test_get_db_session_commits(monkeypatch) -> None:
    await database.disconnect_database()
    monkeypatch.setattr(database.settings, "database_url", "sqlite+aiosqlite:///:memory:")
    await database.connect_database()

    session_gen = database.get_db_session()
    session = await anext(session_gen)
    assert isinstance(session, AsyncSession)

    # Simulate a successful dependency execution to trigger commit
    with pytest.raises(StopAsyncIteration):
        await session_gen.asend(None)

    await database.disconnect_database()
