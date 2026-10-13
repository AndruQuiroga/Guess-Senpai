from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.core.config import Settings
from app.routers import health


def test_settings_read_swarm_secret_files(tmp_path):
    (tmp_path / "SESSION_SECRET").write_text("test-secret-from-file")
    (tmp_path / "DATABASE_URL").write_text("sqlite+aiosqlite:///test.db")
    settings = Settings(_env_file=None, _secrets_dir=tmp_path)
    assert settings.session_secret == "test-secret-from-file"
    assert settings.database_url == "sqlite+aiosqlite:///test.db"


@pytest.mark.asyncio
async def test_readiness_checks_database(monkeypatch):
    monkeypatch.setattr(health.settings, "redis_url", None)
    assert await health.ready() == {"ok": True}


@pytest.mark.asyncio
async def test_readiness_hides_dependency_errors(monkeypatch):
    def failed_engine():
        raise RuntimeError("private dependency details")

    monkeypatch.setattr(health, "get_engine", failed_engine)
    with pytest.raises(HTTPException) as failure:
        await health.ready()
    assert failure.value.status_code == 503
    assert "private" not in failure.value.detail
