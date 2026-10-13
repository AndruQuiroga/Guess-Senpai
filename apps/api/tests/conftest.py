from __future__ import annotations

import os
import sys
from pathlib import Path
import asyncio

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_PATH = PROJECT_ROOT / "src"
if str(SRC_PATH) not in sys.path:
    sys.path.insert(0, str(SRC_PATH))

from app.core import database as db_module  # noqa: E402
from app.db.models import Base  # noqa: E402


async def _create_engine():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    return engine


@pytest.fixture(autouse=True)
def setup_test_database() -> None:
    engine = asyncio.run(_create_engine())
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    original_engine = db_module._engine
    original_factory = db_module._session_factory
    db_module._engine = engine
    db_module._session_factory = session_factory

    try:
        yield
    finally:
        db_module._engine = original_engine
        db_module._session_factory = original_factory
        asyncio.run(engine.dispose())


@pytest.fixture(autouse=True)
def isolate_anilist(monkeypatch: pytest.MonkeyPatch):
    """No test reaches AniList unless it opts into the public smoke run.

    Tests that need upstream behaviour patch `anilist._send` (or a higher
    level helper) themselves; pacing state starts fresh for every test.
    """
    from app.services import anilist
    from app.services import cache as cache_module

    anilist.reset_rate_state()
    # Shared AniList cache entries (searches, details) must not leak between tests.
    monkeypatch.setattr(cache_module, "_cache", None)
    if os.environ.get("RUN_PUBLIC_UPSTREAM_SMOKE") != "1":

        async def offline_send(body, headers):  # pragma: no cover - only hit by unpatched code
            raise anilist.AniListError("AniList network access is disabled in tests")

        monkeypatch.setattr(anilist, "_send", offline_send)
    yield
    anilist.reset_rate_state()
