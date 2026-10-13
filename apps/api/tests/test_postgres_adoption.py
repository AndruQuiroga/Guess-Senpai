"""Opt-in rehearsal on two EMPTY disposable databases, never a deployed DB.

TEST_ADOPTION_POSTGRES_URL and TEST_ADOPTION_REFERENCE_URL must be different.
The test refuses nonempty databases and does not delete existing objects.
"""
import asyncio
import os
from datetime import date, datetime, timezone
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, select, text
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import get_settings
from app.db.models import Base

BASELINE = "202411090002"
OPTIONAL_TABLES = {"daily_puzzle_sets", "user_profiles"}


def schema_contract(connection):
    inspector = inspect(connection)
    result = {}
    for name in inspector.get_table_names():
        if name == "alembic_version":
            continue
        result[name] = {
            "columns": {c["name"]: (str(c["type"]), c["nullable"]) for c in inspector.get_columns(name)},
            "pk": tuple(inspector.get_pk_constraint(name)["constrained_columns"]),
            "fk": {(tuple(f["constrained_columns"]), f["referred_table"], tuple(f["referred_columns"]), f["options"].get("ondelete")) for f in inspector.get_foreign_keys(name)},
            "unique": {tuple(u["column_names"]) for u in inspector.get_unique_constraints(name)},
            "indexes": {i["name"]: (tuple(i["column_names"]), i["unique"]) for i in inspector.get_indexes(name)},
            "defaults": {c["name"]: c["default"].replace("CURRENT_TIMESTAMP", "now()") for c in inspector.get_columns(name) if c["default"]},
        }
    return result


async def inspect_database(url, *, seed=False):
    db = create_async_engine(url)
    try:
        async with db.begin() as connection:
            if seed:
                names = await connection.run_sync(lambda c: inspect(c).get_table_names())
                assert not names, "Rehearsal requires an EMPTY disposable database"
                await connection.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
                tables = [t for n, t in Base.metadata.tables.items() if n not in OPTIONAL_TABLES]
                await connection.run_sync(lambda c: Base.metadata.create_all(c, tables=tables))
                now = datetime(2026, 10, 1, tzinfo=timezone.utc)
                fixtures = {
                    "users": {"id": 123, "username": "disposable", "access_token": "synthetic-only", "access_token_expires_at": now},
                    "sessions": {"id": "synthetic-session", "user_id": 123, "token_hash": "synthetic-hash", "expires_at": now},
                    "daily_progress": {"user_id": 123, "puzzle_date": date(2026, 10, 1), "progress": {"anidle": {"completed": True, "guesses": ["legacy-answer"]}}},
                    "streaks": {"user_id": 123, "count": 7, "last_completed": date(2026, 10, 1)},
                    "user_recent_media": {"user_id": 123, "media_id": 1},
                    "media_titles": {"id": 1, "canonical_title": "Synthetic title", "normalized_title": "synthetic title"},
                    "media_title_aliases": {"media_id": 1, "alias": "Alias", "normalized_alias": "alias", "source": "fixture", "priority": 0},
                    "character_entries": {"id": 1, "canonical_name": "Synthetic character", "normalized_name": "synthetic character"},
                    "character_aliases": {"character_id": 1, "alias": "Character", "normalized_alias": "character", "source": "fixture", "priority": 0},
                }
                for name, values in fixtures.items():
                    await connection.execute(Base.metadata.tables[name].insert().values(**values))
            contract = await connection.run_sync(schema_contract)
            rows = {}
            for name in contract:
                rows[name] = [dict(row) for row in (await connection.execute(select(Base.metadata.tables[name]))).mappings()]
            return contract, rows
    finally:
        await db.dispose()


@pytest.mark.skipif(not os.environ.get("TEST_ADOPTION_POSTGRES_URL"), reason="requires two disposable PostgreSQL databases")
def test_legacy_create_all_adoption_preserves_schema_and_data(monkeypatch):
    legacy = os.environ["TEST_ADOPTION_POSTGRES_URL"]
    reference = os.environ["TEST_ADOPTION_REFERENCE_URL"]
    assert legacy != reference
    before, rows_before = asyncio.run(inspect_database(legacy, seed=True))
    empty, _ = asyncio.run(inspect_database(reference))
    assert not empty, "Reference must be EMPTY"
    root = Path(__file__).resolve().parents[1]
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "alembic"))
    monkeypatch.setattr(get_settings(), "database_url", reference)
    command.upgrade(config, BASELINE)
    expected, _ = asyncio.run(inspect_database(reference))
    assert set(before) == set(expected)
    for name in expected:
        for field in ("columns", "pk", "fk", "unique"):
            assert before[name][field] == expected[name][field], (name, field)
    # Reviewed create_all differences: ORM client defaults do not become SQL
    # defaults; the recent-window index is migration-only. Extra ORM FK indexes
    # and named/unnamed constraints are harmless and retained.
    missing_indexes = {(n, i) for n in expected for i in expected[n]["indexes"] if expected[n]["indexes"][i] not in before[n]["indexes"].values()}
    assert missing_indexes == {("user_recent_media", "ix_user_recent_media_recent_window")}
    differing_defaults = {(n, c) for n in expected for c, value in expected[n]["defaults"].items() if before[n]["defaults"].get(c) != value}
    assert differing_defaults == {("users", "id"), ("streaks", "count"), ("media_title_aliases", "priority"), ("character_aliases", "priority")}

    async def reconcile():
        db = create_async_engine(legacy)
        try:
            async with db.begin() as connection:
                await connection.execute(text("CREATE INDEX ix_user_recent_media_recent_window ON user_recent_media (user_id, seen_at)"))
                for table, column in (("streaks", "count"), ("media_title_aliases", "priority"), ("character_aliases", "priority")):
                    await connection.execute(text(f"ALTER TABLE {table} ALTER COLUMN {column} SET DEFAULT 0"))
        finally:
            await db.dispose()
    asyncio.run(reconcile())
    monkeypatch.setattr(get_settings(), "database_url", legacy)
    command.stamp(config, BASELINE)
    command.upgrade(config, "head")
    command.upgrade(config, "head")
    after, rows_after = asyncio.run(inspect_database(legacy))
    assert set(Base.metadata.tables) == set(after)
    for name in expected:
        assert set(expected[name]["indexes"].values()) <= set(after[name]["indexes"].values())
        for column, value in expected[name]["defaults"].items():
            # AniList owns user IDs; retaining the non-autoincrement ORM schema
            # is intentional. Never invent a sequence for external identities.
            if (name, column) != ("users", "id"):
                assert after[name]["defaults"][column] == value
    for name, rows in rows_before.items():
        assert rows_after[name] == rows, name
        for field in ("columns", "pk", "fk", "unique"):
            assert after[name][field] == before[name][field], (name, field)
    assert rows_after["daily_puzzle_sets"] == []
    assert rows_after["user_profiles"] == []


