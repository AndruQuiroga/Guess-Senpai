from __future__ import annotations

import io
from datetime import date

import pytest
from PIL import Image, ImageChops

from app.puzzles import engine
from app.services.anime_seasons import season_number, season_options, series_groups, series_titles
from app.services import poster_modified
from app.services.poster_modified import MODIFICATIONS, render_modified_poster
from test_puzzles_engine import DummyCache, _media_with_character, make_media, make_guess_opening


@pytest.mark.parametrize("title,prequel,expected", [
    ("A Show", False, 1), ("A Show Season 2", True, 2),
    ("A Show 3rd Season", True, 3), ("A Show III", True, 3),
    ("A Show Part 2", True, None), ("A Show Final Season", True, None),
    ("A Show: Unnumbered Arc", True, None), ("A Show Season 2 Part 2", True, 2),
])
def test_numbered_seasons_do_not_count_cours_or_openings(title, prequel, expected):
    media = make_media(1, title)
    media.relations = {"edges": []}
    if prequel:
        media.relations = {"edges": [{"relationType": "PREQUEL"}]}
    assert season_number(media) == expected
    media.format = "MOVIE"
    assert season_number(media) is None


def test_missing_relation_data_does_not_imply_season_one():
    assert season_number(make_media(1, "An Unnumbered Show")) is None


def test_season_choices_require_multiple_released_tv_seasons():
    first = make_media(1, "A Show")
    first.relations = {"edges": []}
    second = make_media(2, "A Show Season 2")
    second.relations = {"edges": [{"relationType": "PREQUEL", "node": {"id": 1, "type": "ANIME"}}]}
    assert season_options(first, [first], series_groups([first])) == []
    pool = [first, second]
    groups = series_groups(pool)
    assert season_options(first, pool, groups) == [1, 2]
    assert season_options(second, pool, groups) == [1, 2]
    second.status = "NOT_YET_RELEASED"
    assert season_options(first, pool, groups) == []
    second.status = "FINISHED"
    second.format = "MOVIE"
    assert season_options(first, pool, groups) == []
    assert season_options(second, pool, groups) == []
    second.format = "SPECIAL"
    assert season_options(second, pool, groups) == []


def test_related_seasons_share_an_exclusion_group_and_series_aliases():
    first, second, third = [make_media(i, f"A Show Season {i}") for i in (1, 2, 3)]
    second.relations = {"edges": [{"relationType": "PREQUEL", "node": {"id": 1, "type": "ANIME"}}]}
    third.relations = {"edges": [{"relationType": "PREQUEL", "node": {"id": 2, "type": "ANIME"}}]}
    groups = series_groups([first, second, third])
    assert groups[1] == groups[2] == groups[3] == {1, 2, 3}
    assert "A Show" in series_titles(third, [first, second, third], groups)


def test_availability_score_projection_uses_only_stored_metadata():
    content = {"games": {
        "poster_modified": {"puzzle": {"rounds": [
            {"meta": {"year": 2020, "season": "SPRING 2020", "seasonNumber": 2, "seasonOptions": [1, 2]}},
            {"meta": {"year": 2020, "season": "SPRING 2020"}},
            {"meta": {}},
        ]}},
        "guess_the_opening": {"puzzle": {"rounds": [{"meta": {"season": "SPRING 2020", "seasonNumber": 3, "seasonOptions": [1, 2, 3]}}]}},
    }}
    assert engine.daily_round_max_points(content, ["poster_modified", "guess_the_opening", "anidle"]) == {
        "poster_modified": [1000, 800, 600], "guess_the_opening": [1400], "anidle": [3000],
    }


@pytest.mark.asyncio
async def test_daily_effect_order_is_stable_shuffled_and_independent_of_popularity(monkeypatch):
    pool = [_media_with_character(i, f"Show {i}", 100_000 - i) for i in range(1, 121)]
    # Include a later season; any selected member must exclude the whole series.
    pool[1].title = make_media(2, "Show 1 Season 2").title
    pool[1].relations = {"edges": [{"relationType": "PREQUEL", "node": {"id": 1, "type": "ANIME"}}]}

    async def popular(*args): return pool
    async def details(media_id, *args): return pool[media_id - 1]
    async def opening(media, cache, **kwargs): return make_guess_opening(media, **kwargs)
    monkeypatch.setattr(engine, "_load_popular_pool", popular)
    monkeypatch.setattr(engine, "_load_media_details", details)
    monkeypatch.setattr(engine, "_build_guess_opening_round", opening)
    orders = set()
    tiers = engine._popularity_tiers(pool)
    for day_number in range(1, 9):
        day = date(2026, 10, day_number)
        result = await engine._assemble_daily_puzzle(day, user=None, include_guess_opening=True, cache=DummyCache())
        again = await engine._assemble_daily_puzzle(day, user=None, include_guess_opening=True, cache=DummyCache())
        modified = result.games.poster_modified.puzzle.rounds
        assert modified == again.games.poster_modified.puzzle.rounds
        assert {r.meta.modification for r in modified} == set(MODIFICATIONS)
        assert all(r.mediaId in tiers[r.difficulty] for r in modified)
        orders.add(tuple(r.meta.modification for r in modified))
        picked = [result.games.anidle.mediaId]
        for bundle in (result.games.poster_zoomed, result.games.poster_modified, result.games.redacted_synopsis, result.games.guess_the_opening):
            picked.extend(r.mediaId for r in bundle.puzzle.rounds)
        picked.extend(entry.mediaId for r in result.games.character_silhouette.puzzle.rounds for entry in r.entries)
        assert len(picked) == len(set(picked)) == 25
        assert len({1, 2}.intersection(picked)) <= 1
    assert len(orders) > 1


def source_image() -> bytes:
    image = Image.new("RGB", (90, 120))
    image.putdata([(x * 2, y * 2, (x + y) % 255) for y in range(120) for x in range(90)])
    data = io.BytesIO()
    image.save(data, "PNG")
    return data.getvalue()


@pytest.mark.parametrize("modification", MODIFICATIONS)
def test_modified_images_are_deterministic_and_never_show_the_plain_poster(modification):
    source = source_image()
    first = render_modified_poster(source, modification, 0, 42)
    assert first == render_modified_poster(source, modification, 0, 42)
    clearer = render_modified_poster(source, modification, 1, 42)
    last = render_modified_poster(source, modification, 2, 42)
    assert first != clearer != last
    original = Image.open(io.BytesIO(source)).convert("RGB")
    # Even the last clue keeps the effect: the plain poster prints the title.
    for stage in (first, last):
        altered = Image.open(io.BytesIO(stage)).convert("RGB")
        assert ImageChops.difference(original, altered).getbbox() is not None


def test_shuffle_cuts_many_tiles_and_clues_only_put_tiles_back():
    image = Image.new("RGB", (240, 360))
    # Every tile a unique flat colour, so a tile's position is easy to read back.
    cols, rows = poster_modified.SHUFFLE_GRID
    tile_w, tile_h = 240 // cols, 360 // rows
    for index in range(cols * rows):
        x, y = index % cols * tile_w, index // cols * tile_h
        image.paste((index * 10, 255 - index * 10, 128), (x, y, x + tile_w, y + tile_h))
    data = io.BytesIO()
    image.save(data, "PNG")

    def misplaced(hints):
        out = Image.open(io.BytesIO(render_modified_poster(data.getvalue(), "shuffled", hints, 3))).convert("RGB")
        return {
            index for index in range(cols * rows)
            if max(abs(a - b) for a, b in zip(
                out.getpixel((index % cols * tile_w + tile_w // 2, index // cols * tile_h + tile_h // 2)),
                image.getpixel((index % cols * tile_w + tile_w // 2, index // cols * tile_h + tile_h // 2)),
            )) > 5
        }

    stages = [misplaced(hints) for hints in range(3)]
    assert cols * rows >= 24 and len(stages[0]) == cols * rows
    assert stages[0] > stages[1] > stages[2] and stages[2]


@pytest.mark.asyncio
async def test_modified_image_cache_is_separate_per_effect(monkeypatch):
    cache = DummyCache()
    calls = []
    async def get_cache(): return cache
    async def details(*args): return make_media(42, "Show")
    async def source(*args):
        calls.append(1)
        return source_image(), "image/png"
    monkeypatch.setattr(engine, "_get_cache", get_cache)
    monkeypatch.setattr(engine, "_load_media_details", details)
    monkeypatch.setattr(engine, "_load_poster_source", source)
    variants = []
    for modification in MODIFICATIONS:
        variants.append(await engine.generate_modified_poster_image(42, 0, modification))
        assert await engine.generate_modified_poster_image(42, 0, modification) == variants[-1]
    assert len(calls) == 3
    assert len({variant[0] for variant in variants}) == 3
