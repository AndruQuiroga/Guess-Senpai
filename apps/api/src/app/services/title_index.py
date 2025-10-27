from __future__ import annotations

import logging
import re
import unicodedata
from dataclasses import dataclass
from typing import Sequence

from sqlalchemy import func, insert, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import MediaTitle, MediaTitleAlias
from .anilist import Media

logger = logging.getLogger(__name__)


SOURCE_PRIORITY = {
    "user_preferred": 0,
    "english": 1,
    "romaji": 2,
    "native": 3,
    "synonym": 4,
    "variant": 5,
    "canonical": 10,
}


@dataclass(frozen=True)
class TitleMatch:
    media_id: int
    title: str
    normalized: str
    source: str
    priority: int
    is_exact: bool


def normalize_title(value: str | None) -> str:
    if not value:
        return ""
    text = unicodedata.normalize("NFKD", value)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"[^0-9A-Za-z]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text.casefold()


def _determine_source(value: str, media: Media) -> str:
    title = media.title
    if value == (title.userPreferred or ""):
        return "user_preferred"
    if value == (title.english or ""):
        return "english"
    if value == (title.romaji or ""):
        return "romaji"
    if value == (title.native or ""):
        return "native"
    if value in (media.synonyms or []):
        return "synonym"
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


async def upsert_canonical(session: AsyncSession, media: Media) -> None:
    canonical_title = (
        media.title.userPreferred
        or media.title.english
        or media.title.romaji
        or media.title.native
        or str(media.id)
    )
    normalized = normalize_title(canonical_title)
    cover_image = None
    if media.coverImage:
        cover_image = (
            media.coverImage.extraLarge
            or media.coverImage.large
            or media.coverImage.medium
        )
    stmt = _create_insert(
        session,
        MediaTitle,
        {
            "id": media.id,
            "canonical_title": canonical_title,
            "normalized_title": normalized,
            "romaji_title": media.title.romaji,
            "english_title": media.title.english,
            "native_title": media.title.native,
            "user_preferred_title": media.title.userPreferred,
            "cover_image": cover_image,
            "format": media.format,
        },
    )
    update_values = {
        "canonical_title": canonical_title,
        "normalized_title": normalized,
        "romaji_title": media.title.romaji,
        "english_title": media.title.english,
        "native_title": media.title.native,
        "user_preferred_title": media.title.userPreferred,
        "cover_image": cover_image,
        "format": media.format,
        "updated_at": func.now(),
    }

    if hasattr(stmt, "on_conflict_do_update"):
        stmt = stmt.on_conflict_do_update(
            index_elements=[MediaTitle.id],
            set_=update_values,
        )
        await session.execute(stmt)
    else:  # pragma: no cover - fallback for unsupported dialects
        existing = await session.get(MediaTitle, media.id)
        if existing is None:
            session.add(
                MediaTitle(
                    id=media.id,
                    canonical_title=canonical_title,
                    normalized_title=normalized,
                    romaji_title=media.title.romaji,
                    english_title=media.title.english,
                    native_title=media.title.native,
                    user_preferred_title=media.title.userPreferred,
                    cover_image=cover_image,
                    format=media.format,
                )
            )
        else:
            existing.canonical_title = canonical_title
            existing.normalized_title = normalized
            existing.romaji_title = media.title.romaji
            existing.english_title = media.title.english
            existing.native_title = media.title.native
            existing.user_preferred_title = media.title.userPreferred
            existing.cover_image = cover_image
            existing.format = media.format


async def upsert_aliases(
    session: AsyncSession,
    media: Media,
    aliases: Sequence[str],
) -> None:
    payload: dict[str, dict[str, str | int]] = {}
    for value in aliases:
        if not value:
            continue
        normalized = normalize_title(value)
        if not normalized:
            continue
        source = _determine_source(value, media)
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
            "media_id": media.id,
            "alias": record["alias"],
            "normalized_alias": key,
            "source": record["source"],
            "priority": record["priority"],
        }
        for key, record in payload.items()
    ]

    stmt = _create_insert(session, MediaTitleAlias, records)
    if hasattr(stmt, "on_conflict_do_update"):
        dialect = _dialect_name(session)
        conflict_kwargs = (
            {"constraint": "uq_media_title_alias_media"}
            if dialect == "postgresql"
            else {"index_elements": [MediaTitleAlias.media_id, MediaTitleAlias.normalized_alias]}
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
                select(MediaTitleAlias).where(
                    MediaTitleAlias.media_id == record["media_id"],
                    MediaTitleAlias.normalized_alias == record["normalized_alias"],
                )
            )
            alias_obj = existing.scalar_one_or_none()
            if alias_obj is None:
                session.add(MediaTitleAlias(**record))
            else:
                alias_obj.alias = record["alias"]
                alias_obj.source = record["source"]
                alias_obj.priority = record["priority"]


async def ingest_media(
    session: AsyncSession,
    media: Media,
    alias_values: Sequence[str] | None = None,
) -> None:
    await upsert_canonical(session, media)
    aliases = list(alias_values) if alias_values is not None else []
    if not aliases:
        titles = [
            media.title.userPreferred,
            media.title.english,
            media.title.romaji,
            media.title.native,
        ]
        titles.extend(media.synonyms or [])
        aliases = [value for value in titles if value]
    await upsert_aliases(session, media, aliases)


async def search_titles(
    session: AsyncSession,
    query: str,
    limit: int = 8,
) -> list[TitleMatch]:
    normalized_query = normalize_title(query)
    results: dict[int, TitleMatch] = {}

    if normalized_query:
        stmt = (
            select(MediaTitleAlias, MediaTitle)
            .join(MediaTitle, MediaTitleAlias.media_id == MediaTitle.id)
            .where(MediaTitleAlias.normalized_alias == normalized_query)
            .order_by(MediaTitleAlias.priority.asc())
            .limit(limit)
        )
        rows = await session.execute(stmt)
        for alias_obj, canonical in rows.all():
            results[alias_obj.media_id] = TitleMatch(
                media_id=alias_obj.media_id,
                title=alias_obj.alias,
                normalized=alias_obj.normalized_alias,
                source=alias_obj.source,
                priority=alias_obj.priority,
                is_exact=True,
            )

    if len(results) < limit:
        pattern = f"%{query}%"
        stmt = (
            select(MediaTitleAlias, MediaTitle)
            .join(MediaTitle, MediaTitleAlias.media_id == MediaTitle.id)
            .where(MediaTitleAlias.alias.ilike(pattern))
            .order_by(MediaTitleAlias.priority.asc(), func.length(MediaTitleAlias.alias))
            .limit(limit * 3)
        )
        rows = await session.execute(stmt)
        for alias_obj, canonical in rows.all():
            if alias_obj.media_id in results:
                continue
            results[alias_obj.media_id] = TitleMatch(
                media_id=alias_obj.media_id,
                title=alias_obj.alias,
                normalized=alias_obj.normalized_alias,
                source=alias_obj.source,
                priority=alias_obj.priority,
                is_exact=alias_obj.normalized_alias == normalized_query,
            )
            if len(results) >= limit:
                break

    if len(results) < limit:
        pattern = f"%{query}%"
        stmt = (
            select(MediaTitle)
            .where(MediaTitle.canonical_title.ilike(pattern))
            .order_by(func.length(MediaTitle.canonical_title))
            .limit(limit * 2)
        )
        rows = await session.execute(stmt)
        for canonical in rows.scalars():
            if canonical.id in results:
                continue
            results[canonical.id] = TitleMatch(
                media_id=canonical.id,
                title=canonical.canonical_title,
                normalized=canonical.normalized_title,
                source="canonical",
                priority=SOURCE_PRIORITY["canonical"],
                is_exact=canonical.normalized_title == normalized_query,
            )
            if len(results) >= limit:
                break

    ordered = sorted(
        results.values(),
        key=lambda item: (
            0 if item.is_exact else 1,
            item.priority,
            len(item.title),
        ),
    )
    return ordered[:limit]
