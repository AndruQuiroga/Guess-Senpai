from __future__ import annotations

from pathlib import Path

from app.core import database


def test_get_alembic_config_preserves_async_driver(monkeypatch) -> None:
    monkeypatch.setattr(database.settings, "database_url", "sqlite+aiosqlite:///test.db")
    monkeypatch.setattr(database.settings, "alembic_ini_path", "alembic.ini")
    monkeypatch.setattr(database.settings, "alembic_migrations_path", "alembic")

    config = database._get_alembic_config()

    assert config.get_main_option("sqlalchemy.url") == "sqlite+aiosqlite:///test.db"


def test_get_alembic_config_resolves_script_location(monkeypatch) -> None:
    monkeypatch.setattr(database.settings, "database_url", "sqlite+aiosqlite:///test.db")

    config = database._get_alembic_config()
    script_location = Path(config.get_main_option("script_location"))

    # The script location should resolve to the alembic directory within the API
    # project, not remain a relative path.  This ensures the migrations are
    # discoverable when commands are invoked from different working
    # directories.
    assert script_location.exists()
    assert script_location.name == "alembic"
