"""Opt-in integration test; TEST_POSTGRES_URL must point to an empty disposable DB."""
import asyncio
import os
from datetime import datetime, timezone
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core import database
from app.core.config import get_settings
from app.db.models import Base, DailyPuzzleSet, User
from app.puzzles import engine
from app.puzzles.models import DailyProgressPayload, GameProgressPayload
from app.services import progress
from test_daily_snapshots import local_generation


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRES_URL"), reason="requires disposable PostgreSQL")
def test_fresh_postgres_migrations_and_concurrent_publication(monkeypatch, local_generation):
    url = os.environ["TEST_POSTGRES_URL"]
    monkeypatch.setattr(get_settings(), "database_url", url)
    root = Path(__file__).resolve().parents[1]
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "alembic"))
    command.upgrade(config, "head")
    command.upgrade(config, "head")

    async def scenario():
        db = create_async_engine(url)
        factory = async_sessionmaker(db, expire_on_commit=False)
        monkeypatch.setattr(database, "_engine", db)
        monkeypatch.setattr(database, "_session_factory", factory)
        try:
            async with db.connect() as connection:
                names = await connection.run_sync(lambda conn: inspect(conn).get_table_names())
                assert set(Base.metadata.tables) <= set(names)
            day = datetime.now(timezone.utc).date()
            # Synchronize candidate generation so all requests race on insertion.
            assemble = engine._assemble_daily_puzzle
            barrier = asyncio.Barrier(3)

            async def racing(*args, **kwargs):
                candidate = await assemble(*args, **kwargs)
                await barrier.wait()
                return candidate

            monkeypatch.setattr(engine, "_assemble_daily_puzzle", racing)
            responses = await asyncio.gather(*(engine.get_daily_puzzle(day) for _ in range(3)))
            assert all(item.model_dump() == responses[0].model_dump() for item in responses)
            async with factory() as session:
                assert len((await session.scalars(select(DailyPuzzleSet))).all()) == 1
                session.add(User(id=99, access_token="test-only", access_token_expires_at=datetime.now(timezone.utc)))
                await session.commit()
            def update(mode):
                return DailyProgressPayload(date=day, puzzle_id=f"daily:{day}", rules_version="1",
                    progress={mode: GameProgressPayload(completed=True, round=3, guesses=[mode])})
            await asyncio.gather(progress.merge_daily_progress(99, update("anidle")),
                                 progress.merge_daily_progress(99, update("poster_zoomed")))
            result = await progress.load_daily_progress(99, day, f"daily:{day}", "1")
            assert set(result.progress) == {"anidle", "poster_zoomed"}
        finally:
            await db.dispose()

    asyncio.run(scenario())
