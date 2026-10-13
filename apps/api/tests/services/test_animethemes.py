import pytest

from app.services import animethemes


@pytest.mark.asyncio
async def test_current_nested_api_finds_audio_clip(monkeypatch):
    calls = []

    async def request(path, *, params=None):
        calls.append((path, params))
        if path == "/search/":
            return {"search": {"anime": [{"id": 521, "slug": "cowboy_bebop", "name": "Cowboy Bebop"}]}}
        return {"anime": {"animethemes": [{"type": "OP", "slug": "OP1", "song": {"title": "Tank!", "artists": [{"name": "Seatbelts"}]}, "animethemeentries": [{"videos": [{"link": "https://example.test/op.webm", "audio": {"link": "https://example.test/op.ogg"}}]}]}]}}

    monkeypatch.setattr(animethemes, "_request", request)
    clip = await animethemes.find_opening_clip(["Cowboy Bebop"])
    assert clip.audio_url == "https://example.test/op.ogg"
    assert clip.video_url == "https://example.test/op.webm"
    assert clip.artist == "Seatbelts"
    assert "animethemes.animethemeentries.videos.audio" in calls[1][1]["include"]


def test_missing_or_filtered_opening_is_unavailable():
    assert animethemes.extract_opening_clip({"anime": {"animethemes": []}}) is None
    assert animethemes.extract_opening_clip({"anime": {"animethemes": [{"type": "OP", "animethemeentries": [{"spoiler": True, "videos": [{"link": "https://example.test/spoiler"}]}]}]}}) is None


def test_historical_json_api_still_supported():
    payload = {"data": {"relationships": {"animethemes": {"data": [{"type": "animethemes", "id": "1"}]}}}, "included": [
        {"type": "animethemes", "id": "1", "attributes": {"type": "OP"}, "relationships": {"animethemeentries": {"data": [{"type": "entries", "id": "2"}]}}},
        {"type": "entries", "id": "2", "relationships": {"videos": {"data": [{"type": "videos", "id": "3"}]}}},
        {"type": "videos", "id": "3", "attributes": {"link": "https://example.test/legacy.webm"}},
    ]}
    assert animethemes.extract_opening_clip(payload).video_url == "https://example.test/legacy.webm"
