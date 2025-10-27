from __future__ import annotations

import pytest

from app.core.database import get_session_factory
from app.puzzles.engine import _title_variants
from app.services.anilist import Media, Title
from app.services import title_index


def make_media() -> Media:
    return Media(
        id=4242,
        title=Title(
            userPreferred="Fullmetal Alchemist: Brotherhood",
            english="Fullmetal Alchemist: Brotherhood",
            romaji="Hagane no Renkinjutsushi: Brotherhood",
            native="鋼の錬金術師",
        ),
        synonyms=["FMA Brotherhood", "Hagaren"],
        format="TV",
    )


@pytest.mark.asyncio
async def test_ingest_media_creates_aliases_and_searches() -> None:
    media = make_media()
    session_factory = get_session_factory()

    async with session_factory() as session:
        await title_index.ingest_media(session, media, _title_variants(media))
        await session.commit()

    async with session_factory() as session:
        matches = await title_index.search_titles(session, "FMA", limit=5)

    assert matches
    assert matches[0].media_id == media.id
    assert matches[0].title.lower().startswith("fma") or "fullmetal" in matches[0].title.lower()


@pytest.mark.asyncio
async def test_normalized_search_handles_accents() -> None:
    media = make_media()
    session_factory = get_session_factory()

    async with session_factory() as session:
        await title_index.ingest_media(session, media, _title_variants(media))
        await session.commit()

    async with session_factory() as session:
        matches = await title_index.search_titles(session, "Hagane no Renkinjutsushi", limit=5)

    assert any(match.media_id == media.id for match in matches)
