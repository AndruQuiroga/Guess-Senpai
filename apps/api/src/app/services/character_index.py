from __future__ import annotations

import logging
import re
import unicodedata
from dataclasses import dataclass
from typing import Iterable, Optional, Sequence

from sqlalchemy import func, insert, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import CharacterAlias, CharacterEntry
from .anilist import Character, MediaCharacterEdge

logger = logging.getLogger(__name__)


SOURCE_PRIORITY = {
    "user_preferred": 0,
    "full": 1,
    "native": 2,
    "variant": 5,
    "canonical": 10,
}


def normalize_name(value: str | None) -> str:
    if not value:
        return ""
    text = unicodedata.normalize("NFKD", value)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"[^0-9A-Za-z]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text.casefold()


@dataclass(frozen=True)
class CharacterMatch:
    character_id: int
    name: str
    normalized: str
    source: str
    priority: int
    is_exact: bool
    canonical_name: str
    image: Optional[str]


def _determine_source(value: str, character: Character) -> str:
    name = character.name
    if value == (name.userPreferred or ""):
        return "user_preferred"
    if value == (name.full or ""):
        return "full"
    if value == (name.native or ""):
        return "native"
    return "variant"


def _dialect_name(session: AsyncSession) -> str:
    bind = session.sync_session.bind
    if bind is None:
        return ""
    return bind.dialect.name


def _create_insert(session: AsyncSession, model, values):
    dialect = _dialect_name(session)
    if dialect == "postgresql":
        stmt = pg_insert(model)
    elif dialect == "sqlite":
        stmt = sqlite_insert(model)
    else:
        stmt = insert(model)
    return stmt.values(values)


def _expand_aliases(values: Iterable[str | None]) -> list[str]:
    results: set[str] = set()
    for value in values:
        if not value:
            continue
        trimmed = value.strip()
        if not trimmed:
            continue
        candidates = {trimmed}
        # Split on common delimiters to capture alternate names.
        for delimiter in ["/", ",", "·"]:
            if delimiter in trimmed:
                for part in trimmed.split(delimiter):
                    candidate = part.strip()
                    if candidate:
                        candidates.add(candidate)
        for match in re.findall(r"\(([^)]+)\)", trimmed):
            candidate = match.strip()
            if candidate:
                candidates.add(candidate)
        results.update(candidates)
    ordered = sorted(results, key=lambda item: (len(item), item.casefold()))
    return ordered


async def upsert_character_entry(session: AsyncSession, character: Character) -> None:
    canonical = (
        character.name.userPreferred
        or character.name.full
        or character.name.native
        or str(character.id)
    )
    normalized = normalize_name(canonical)
    image_large = character.image.large if character.image else None
    image_medium = character.image.medium if character.image else None
    stmt = _create_insert(
        session,
        CharacterEntry,
        {
            "id": character.id,
            "canonical_name": canonical,
            "normalized_name": normalized,
            "full_name": character.name.full,
            "native_name": character.name.native,
            "user_preferred_name": character.name.userPreferred,
            "image_large": image_large,
            "image_medium": image_medium,
        },
    )
    update_values = {
        "canonical_name": canonical,
        "normalized_name": normalized,
        "full_name": character.name.full,
        "native_name": character.name.native,
        "user_preferred_name": character.name.userPreferred,
        "image_large": image_large,
        "image_medium": image_medium,
        "updated_at": func.now(),
    }

    if hasattr(stmt, "on_conflict_do_update"):
        stmt = stmt.on_conflict_do_update(
            index_elements=[CharacterEntry.id],
            set_=update_values,
        )
        await session.execute(stmt)
    else:  # pragma: no cover - fallback for unsupported dialects
        existing = await session.get(CharacterEntry, character.id)
        if existing is None:
            session.add(
                CharacterEntry(
                    id=character.id,
                    canonical_name=canonical,
                    normalized_name=normalized,
                    full_name=character.name.full,
                    native_name=character.name.native,
                    user_preferred_name=character.name.userPreferred,
                    image_large=image_large,
                    image_medium=image_medium,
                )
            )
        else:
            existing.canonical_name = canonical
            existing.normalized_name = normalized
            existing.full_name = character.name.full
            existing.native_name = character.name.native
            existing.user_preferred_name = character.name.userPreferred
            existing.image_large = image_large
            existing.image_medium = image_medium


async def upsert_character_aliases(
    session: AsyncSession,
    character: Character,
    aliases: Sequence[str],
) -> None:
    payload: dict[str, dict[str, str | int]] = {}
    for value in aliases:
        if not value:
            continue
        normalized = normalize_name(value)
        if not normalized:
            continue
        source = _determine_source(value, character)
        priority = SOURCE_PRIORITY.get(source, SOURCE_PRIORITY["variant"])
        existing = payload.get(normalized)
        if existing is None or priority < int(existing["priority"]) or (
            priority == int(existing["priority"]) and len(value) < len(str(existing["alias"]))
        ):
            payload[normalized] = {
                "alias": value,
                "normalized_alias": normalized,
                "source": source,
                "priority": priority,
            }

    if not payload:
        return

    records = [
        {
            "character_id": character.id,
            "alias": record["alias"],
            "normalized_alias": key,
            "source": record["source"],
            "priority": record["priority"],
        }
        for key, record in payload.items()
    ]

    stmt = _create_insert(session, CharacterAlias, records)
    if hasattr(stmt, "on_conflict_do_update"):
        dialect = _dialect_name(session)
        conflict_kwargs = (
            {"constraint": "uq_character_alias_character"}
            if dialect == "postgresql"
            else {
                "index_elements": [
                    CharacterAlias.character_id,
                    CharacterAlias.normalized_alias,
                ]
            }
        )
        stmt = stmt.on_conflict_do_update(
            **conflict_kwargs,
            set_={
                "alias": stmt.excluded.alias,
                "source": stmt.excluded.source,
                "priority": stmt.excluded.priority,
                "updated_at": func.now(),
            },
        )
        await session.execute(stmt)
    else:  # pragma: no cover - fallback for unsupported dialects
        for record in records:
            existing = await session.execute(
                select(CharacterAlias).where(
                    CharacterAlias.character_id == record["character_id"],
                    CharacterAlias.normalized_alias == record["normalized_alias"],
                )
            )
            alias_obj = existing.scalar_one_or_none()
            if alias_obj is None:
                session.add(CharacterAlias(**record))
            else:
                alias_obj.alias = record["alias"]
                alias_obj.source = record["source"]
                alias_obj.priority = record["priority"]


async def ingest_character(
    session: AsyncSession,
    character: Character,
    alias_values: Sequence[str] | None = None,
) -> None:
    await upsert_character_entry(session, character)
    aliases = list(alias_values) if alias_values is not None else []
    if not aliases:
        aliases = _expand_aliases(
            [
                character.name.userPreferred,
                character.name.full,
                character.name.native,
            ]
        )
    else:
        aliases = _expand_aliases(alias_values)

    if aliases:
        await upsert_character_aliases(session, character, aliases)


async def ingest_characters(
    session: AsyncSession,
    edges: Sequence[MediaCharacterEdge] | None,
) -> None:
    if not edges:
        return
    seen: set[int] = set()
    for edge in edges:
        if not edge or not edge.node:
            continue
        character = edge.node
        if character.id in seen:
            continue
        seen.add(character.id)
        try:
            await ingest_character(session, character)
        except Exception:  # pragma: no cover - defensive logging
            logger.exception("Failed to ingest character %s", character.id)


async def search_characters(
    session: AsyncSession,
    query: str,
    limit: int = 8,
) -> list[CharacterMatch]:
    normalized_query = normalize_name(query)
    results: dict[int, CharacterMatch] = {}

    if normalized_query:
        stmt = (
            select(CharacterAlias, CharacterEntry)
            .join(CharacterEntry, CharacterAlias.character_id == CharacterEntry.id)
            .where(CharacterAlias.normalized_alias == normalized_query)
            .order_by(CharacterAlias.priority.asc())
            .limit(limit)
        )
        rows = await session.execute(stmt)
        for alias_obj, entry in rows.all():
            image = entry.image_large or entry.image_medium
            results[alias_obj.character_id] = CharacterMatch(
                character_id=alias_obj.character_id,
                name=alias_obj.alias,
                normalized=alias_obj.normalized_alias,
                source=alias_obj.source,
                priority=alias_obj.priority,
                is_exact=True,
                canonical_name=entry.canonical_name,
                image=image,
            )

    if len(results) < limit:
        pattern = f"%{query}%"
        stmt = (
            select(CharacterAlias, CharacterEntry)
            .join(CharacterEntry, CharacterAlias.character_id == CharacterEntry.id)
            .where(CharacterAlias.alias.ilike(pattern))
            .order_by(CharacterAlias.priority.asc(), func.length(CharacterAlias.alias))
            .limit(limit * 3)
        )
        rows = await session.execute(stmt)
        for alias_obj, entry in rows.all():
            if alias_obj.character_id in results:
                continue
            image = entry.image_large or entry.image_medium
            results[alias_obj.character_id] = CharacterMatch(
                character_id=alias_obj.character_id,
                name=alias_obj.alias,
                normalized=alias_obj.normalized_alias,
                source=alias_obj.source,
                priority=alias_obj.priority,
                is_exact=alias_obj.normalized_alias == normalized_query,
                canonical_name=entry.canonical_name,
                image=image,
            )
            if len(results) >= limit:
                break

    if len(results) < limit:
        pattern = f"%{query}%"
        stmt = (
            select(CharacterEntry)
            .where(CharacterEntry.canonical_name.ilike(pattern))
            .order_by(func.length(CharacterEntry.canonical_name))
            .limit(limit * 2)
        )
        rows = await session.execute(stmt)
        for entry in rows.scalars():
            if entry.id in results:
                continue
            image = entry.image_large or entry.image_medium
            results[entry.id] = CharacterMatch(
                character_id=entry.id,
                name=entry.canonical_name,
                normalized=entry.normalized_name,
                source="canonical",
                priority=SOURCE_PRIORITY["canonical"],
                is_exact=entry.normalized_name == normalized_query,
                canonical_name=entry.canonical_name,
                image=image,
            )
            if len(results) >= limit:
                break

    ordered = sorted(
        results.values(),
        key=lambda item: (
            0 if item.is_exact else 1,
            item.priority,
            len(item.name),
        ),
    )
    return ordered[:limit]


async def load_character_aliases(
    session: AsyncSession,
    character_id: int,
    *,
    limit: int = 100,
) -> list[str]:
    stmt = (
        select(CharacterAlias.alias)
        .where(CharacterAlias.character_id == character_id)
        .order_by(CharacterAlias.priority.asc(), func.length(CharacterAlias.alias))
        .limit(limit)
    )
    rows = await session.execute(stmt)
    return list(rows.scalars())
