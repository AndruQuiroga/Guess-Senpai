"""Production entry point: wait for PostgreSQL, migrate, then serve one API worker."""
from __future__ import annotations

import asyncio
import os
import subprocess

from .config import settings
from .database import _ping_database, get_engine


async def wait_for_database() -> None:
    engine = get_engine()
    try:
        for attempt in range(max(1, settings.database_connect_retries)):
            try:
                await _ping_database(engine)
                return
            except Exception:
                if attempt + 1 >= max(1, settings.database_connect_retries):
                    raise RuntimeError("Database did not become ready") from None
                await asyncio.sleep(settings.database_connect_retry_interval_seconds)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    if not settings.session_cookie_secure:
        raise RuntimeError("Production requires SESSION_COOKIE_SECURE=true")
    if settings.session_secret in {"change-me", "dev-insecure-session-secret"}:
        raise RuntimeError("Production requires a generated session secret")
    asyncio.run(wait_for_database())
    subprocess.run(["alembic", "upgrade", "head"], check=True)
    # OAuth callback query strings contain one-time credentials.
    os.execvp("uvicorn", ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"])
