from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect

from app.core.config import get_settings
from app.db.models import Base


def test_fresh_upgrade_has_every_model_table_and_column(tmp_path, monkeypatch):
    database_path = tmp_path / "migration.db"
    monkeypatch.setattr(get_settings(), "database_url", f"sqlite+aiosqlite:///{database_path}")
    root = Path(__file__).resolve().parents[1]
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "alembic"))
    command.upgrade(config, "head")
    command.upgrade(config, "head")
    engine = create_engine(f"sqlite:///{database_path}")
    with engine.connect() as connection:
        inspector = inspect(connection)
        for name, table in Base.metadata.tables.items():
            assert inspector.has_table(name), name
            actual = {column["name"] for column in inspector.get_columns(name)}
            assert set(table.columns.keys()) <= actual, name
    engine.dispose()
