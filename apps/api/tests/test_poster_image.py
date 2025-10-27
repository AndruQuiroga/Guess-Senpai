import io
import types

import pytest
from PIL import Image

from app.puzzles import engine as puzzle_engine
from app.services.anilist import CoverImage, Media, Title
from app.services.cache import InMemoryCache


@pytest.mark.asyncio
async def test_generate_poster_image_uses_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    media = Media(
        id=321,
        title=Title(romaji="Test Show", english="Test Show"),
        coverImage=CoverImage(extraLarge="https://example.com/poster.png"),
    )

    cache = InMemoryCache()

    async def fake_get_cache() -> InMemoryCache:
        return cache

    monkeypatch.setattr(puzzle_engine, "_get_cache", fake_get_cache)

    async def fake_load_media_details(media_id, _cache, _settings):
        assert media_id == media.id
        return media

    monkeypatch.setattr(puzzle_engine, "_load_media_details", fake_load_media_details)

    base_image = Image.new("RGB", (16, 16), color=(180, 90, 40))
    buffer = io.BytesIO()
    base_image.save(buffer, format="PNG")
    image_bytes = buffer.getvalue()

    call_count = {"value": 0}

    class FakeResponse:
        def __init__(self) -> None:
            self.content = image_bytes
            self.headers = {"content-type": "image/png"}

        def raise_for_status(self) -> None:
            return None

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs) -> None:  # noqa: D401 - signature mirrors httpx
            pass

        async def __aenter__(self):
            call_count["value"] += 1
            return self

        async def __aexit__(self, exc_type, exc, tb) -> None:
            return None

        async def get(self, url: str) -> FakeResponse:
            assert url == media.coverImage.extraLarge
            return FakeResponse()

    import httpx as real_httpx

    mock_httpx = types.SimpleNamespace(AsyncClient=FakeAsyncClient, HTTPError=real_httpx.HTTPError)
    monkeypatch.setattr(puzzle_engine, "httpx", mock_httpx)

    content, mime = await puzzle_engine.generate_poster_image(media.id, 0.35)

    assert mime == "image/jpeg"
    assert content
    assert call_count["value"] == 1

    cached_content, cached_mime = await puzzle_engine.generate_poster_image(media.id, 0.36)

    assert cached_mime == "image/jpeg"
    assert cached_content == content
    # cache hit should avoid downloading again despite slightly different clarity within same bucket
    assert call_count["value"] == 1
