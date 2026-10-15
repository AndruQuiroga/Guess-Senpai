from __future__ import annotations

from datetime import date
from typing import Any, List

import pytest

from app.puzzles import engine
from app.puzzles.engine import UserContext
from app.puzzles.models import (
    CharacterSilhouetteCharacter,
    CharacterSilhouetteGame,
    CharacterSilhouetteRound,
    GuessOpeningMeta,
    GuessOpeningRound,
    OpeningClip,
    PosterZoomPuzzleBundle,
    PosterZoomGame,
    RedactedSynopsisSegment,
    RoundSpec,
    SolutionPayload,
)
from app.services.anilist import (
    Character,
    CharacterImage,
    CharacterName,
    Media,
    MediaCharacterEdge,
    MediaCharacters,
    MediaList,
    MediaListCollection,
    MediaListEntry,
    Title,
)


@pytest.fixture(autouse=True)
def disable_remote_opening_pool(monkeypatch):
    monkeypatch.setattr(engine.settings, "guess_opening_pool_enabled", False)


class DummyCache:
    def __init__(self) -> None:
        self._storage: dict[str, Any] = {}

    async def remember(self, key: str, ttl: int, creator):  # type: ignore[override]
        if key in self._storage:
            return self._storage[key]
        value = await creator()
        self._storage[key] = value
        return value

    async def set(self, key: str, value: Any, ttl: int) -> None:
        self._storage[key] = value

    async def get(self, key: str) -> Any:
        return self._storage.get(key)


def make_media(media_id: int, title: str) -> Media:
    return Media(
        id=media_id,
        title=Title(english=title, userPreferred=title),
        genres=["Action"],
        season="SPRING",
        seasonYear=2024,
        episodes=12,
        duration=24,
        popularity=1000,
        averageScore=75,
        description=f"Synopsis for {title}",
        format="TV",
        externalLinks=[{"site": "Crunchyroll", "url": f"https://example.com/{media_id}"}],
    )


def make_guess_opening(
    media: Media, *, order: int = 1, total_rounds: int = 3, difficulty: int | None = None
) -> GuessOpeningRound:
    return GuessOpeningRound(
        order=order,
        difficulty=difficulty,
        mediaId=media.id,
        spec=[RoundSpec(difficulty=1, hints=["length"])],
        answer=media.title.english or "Unknown",
        clip=OpeningClip(
            audioUrl="https://cdn.example.com/opening.mp3",
            lengthSeconds=90,
        ),
        meta=GuessOpeningMeta(
            songTitle="Theme",
            artist="Singer",
            roundOrder=order,
            roundTotal=total_rounds,
        ),
        solution=SolutionPayload(
            titles=media.title,
            coverImage=None,
            synopsis=None,
            aniListUrl=f"https://anilist.co/anime/{media.id}",
            streamingLinks=[],
        ),
    )


def make_character_silhouette(media: Media) -> CharacterSilhouetteGame:
    return CharacterSilhouetteGame(
        spec=[
            CharacterSilhouetteRound(
                difficulty=1,
                label="Silhouette",
                filter="brightness(0)",
            ),
            CharacterSilhouetteRound(
                difficulty=2,
                label="Spotlight",
                filter="brightness(0.4)",
            ),
            CharacterSilhouetteRound(
                difficulty=3,
                label="Reveal",
                filter="none",
            ),
        ],
        answer=media.title.english or "Unknown",
        character=CharacterSilhouetteCharacter(
            id=media.id * 10,
            name=f"Hero {media.id}",
            image=f"https://cdn.example.com/character-{media.id}.jpg",
            role="Main",
        ),
    )


def make_character_edge(index: int) -> MediaCharacterEdge:
    character = Character(
        id=10_000 + index,
        name=CharacterName(
            full=f"Character {index}",
            userPreferred=f"Character {index}",
            native=None,
        ),
        image=CharacterImage(large=f"https://cdn.example.com/character-{index}.jpg"),
    )
    return MediaCharacterEdge(role="MAIN", node=character)


def test_build_candidate_pool_prefers_novel_media() -> None:
    popular = [make_media(1, "Watched"), make_media(2, "Watching"), make_media(3, "Fresh")]
    user_lists = MediaListCollection(
        lists=[
            MediaList(
                status="COMPLETED",
                entries=[MediaListEntry(media=popular[0])],
            ),
            MediaList(
                status="CURRENT",
                entries=[MediaListEntry(media=popular[1])],
            ),
        ]
    )

    pool = engine._build_candidate_pool(popular, user_lists)

    assert [media.id for media in pool] == [3]


def test_build_candidate_pool_falls_back_excluding_recent() -> None:
    popular = [make_media(10, "Classic"), make_media(11, "Returnee")]
    user_lists = MediaListCollection(
        lists=[
            MediaList(
                status="COMPLETED",
                entries=[MediaListEntry(media=popular[0])],
            ),
            MediaList(
                status="COMPLETED",
                entries=[MediaListEntry(media=popular[1])],
            ),
        ]
    )

    pool = engine._build_candidate_pool(popular, user_lists, recent_ids=[10])

    assert [media.id for media in pool] == [11]


def test_character_guess_rounds_preserve_difficulty(monkeypatch: pytest.MonkeyPatch) -> None:
    media = make_media(99, "Spotlight Saga")

    allocations: List[List[MediaCharacterEdge]] = [
        [make_character_edge(round_index * 4 + entry) for entry in range(4)]
        for round_index in range(len(engine.CHARACTER_GUESS_ROUND_CONFIG))
    ]

    monkeypatch.setattr(
        engine.character_pool,
        "build_round_pools",
        lambda *_args, **_kwargs: allocations,
    )

    game = engine._build_character_guess_game(media)

    assert game is not None
    assert [round_payload.difficulty for round_payload in game.rounds] == [
        config["difficulty"] for config in engine.CHARACTER_GUESS_ROUND_CONFIG
    ]
    assert [round_spec.difficulty for round_spec in game.spec] == [
        config["difficulty"] for config in engine.CHARACTER_GUESS_ROUND_CONFIG
    ]

    for config, round_payload in zip(engine.CHARACTER_GUESS_ROUND_CONFIG, game.rounds):
        assert len(round_payload.entries) == 4
        assert all(entry.reveal.label == config["label"] for entry in round_payload.entries)

def test_character_game_rejects_missing_character_pool(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(engine.character_pool, "build_round_pools", lambda *args, **kwargs: [])
    assert engine._build_character_guess_game(make_media(91, "No cast")) is None


def test_build_poster_bundle_without_cover_image() -> None:
    media = make_media(505, "No Cover")

    bundle = PosterZoomPuzzleBundle(
        mediaId=media.id,
        puzzle=PosterZoomGame(
            spec=engine.POSTER_ROUNDS,
            rounds=[
                engine._build_poster_round(
                    media=media,
                    order=1,
                    difficulty=engine.POSTER_ROUNDS[0].difficulty,
                )
            ],
        ),
        solution=engine._build_solution(media),
    )

    assert bundle.mediaId == media.id
    assert bundle.puzzle.rounds
    primary_round = bundle.puzzle.rounds[0]
    assert primary_round.mediaId == media.id
    assert primary_round.meta.season == "Spring 2024"


def test_redacted_synopsis_masks_majority_of_words() -> None:
    media = make_media(777, "Mystery Story")
    media.description = (
        "Mystery Story follows a clever detective and an enigmatic partner as they chase impossible clues across the city."
    )

    text, segments, masked_indices, masked_words = engine._redact_description(media)

    assert text == media.description.strip()
    assert segments
    assert len(masked_indices) == len(masked_words)

    total_words = sum(1 for segment in segments if engine.WORD_PATTERN.fullmatch(segment.text))
    assert total_words > 0

    masked_ratio = len(masked_indices) / total_words
    assert masked_ratio >= 0.65

    masked_text = {segments[index].text.casefold() for index in masked_indices}
    assert "mystery" in masked_text
    assert "story" in masked_text


def test_anidle_synopsis_uses_redacted_masking(monkeypatch: pytest.MonkeyPatch) -> None:
    media = make_media(888, "Masked Legends")

    segments = [
        RedactedSynopsisSegment(text="First", masked=True),
        RedactedSynopsisSegment(text=" ", masked=False),
        RedactedSynopsisSegment(text="Second", masked=True),
        RedactedSynopsisSegment(text=" ", masked=False),
        RedactedSynopsisSegment(text="Third", masked=True),
    ]
    masked_indices = [0, 2, 4]

    def fake_redact(_media: Media) -> tuple[str, list[RedactedSynopsisSegment], list[int], list[str]]:
        return "First Second Third", segments, masked_indices, ["First", "Second", "Third"]

    monkeypatch.setattr(engine, "_redact_description", fake_redact)

    hints = engine._build_anidle_synopsis(media)

    assert [hint.ratio for hint in hints] == [0.2, 0.35, 0.5]
    assert hints[0].text == "First [REDACTED] [REDACTED]"
    assert hints[1].text == "First Second [REDACTED]"
    assert hints[2].text == "First Second Third"


def test_anidle_new_rules_and_legacy_payload_are_distinct() -> None:
    from app.puzzles.models import AnidleGame

    generated = engine._build_anidle(make_media(889, "Finite Daily"))
    assert generated.rules is not None
    assert generated.rules.version == "2"
    assert generated.rules.max_attempts == 20
    assert generated.rules.hint_after_incorrect == [10, 13, 16]
    assert len(generated.spec) == 1
    legacy_json = generated.model_dump(mode="json", exclude={"rules"})
    legacy_json["spec"] = [spec.model_dump() for spec in engine.ANIDLE_ROUNDS]
    legacy = AnidleGame.model_validate(legacy_json)
    assert legacy.rules is None
    assert len(legacy.spec) == 3
    assert "rules" not in legacy_json

@pytest.mark.asyncio
async def test_daily_puzzle_builds_distinct_bundles(monkeypatch: pytest.MonkeyPatch) -> None:
    day = date(2024, 1, 5)
    popular = [_media_with_character(800 + i, f"Extra {i}", 1000 - i) for i in range(48)]
    media_by_id = {media.id: media for media in popular}

    async def fake_load_popular_pool(day_value, cache, settings):
        return list(popular)

    async def fake_load_media_details(media_id: int, cache, settings):
        return media_by_id.get(media_id) or make_media(media_id, f"Media {media_id}")

    async def fake_build_guess_opening_round(media: Media, cache, **kwargs):
        return make_guess_opening(media, **kwargs)

    monkeypatch.setattr(engine, "_load_popular_pool", fake_load_popular_pool)
    monkeypatch.setattr(engine, "_load_media_details", fake_load_media_details)
    monkeypatch.setattr(engine, "_build_guess_opening_round", fake_build_guess_opening_round)
    monkeypatch.setattr(engine, "_build_character_guess_game", make_character_silhouette)

    cache = DummyCache()
    result = await engine._assemble_daily_puzzle(
        day,
        user=None,
        include_guess_opening=True,
        cache=cache,
    )

    assert result.guess_the_opening_enabled is bool(result.games.guess_the_opening)
    assert result.games.character_silhouette is not None

    poster_rounds = result.games.poster_zoomed.puzzle.rounds
    assert poster_rounds
    assert len(poster_rounds) == len(engine.POSTER_ROUNDS)
    poster_round_ids = [round.mediaId for round in poster_rounds]
    assert len(poster_round_ids) == len(set(poster_round_ids))

    bundle_ids = [
        result.games.anidle.mediaId,
        result.games.redacted_synopsis.mediaId,
        result.games.character_silhouette.mediaId,
    ]
    bundle_ids.extend(poster_round_ids)
    if result.games.guess_the_opening:
        rounds = result.games.guess_the_opening.puzzle.rounds
        assert len(rounds) == 3
        bundle_ids.extend(round.mediaId for round in rounds)

    assert len(bundle_ids) == len(set(bundle_ids))
    assert result.games.anidle.solution.aniListUrl.endswith(
        str(result.games.anidle.mediaId)
    )


@pytest.mark.asyncio
async def test_daily_puzzle_poster_rounds_scale_difficulty(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    day = date(2024, 1, 7)
    poster_media = [
        make_media(601, "Poster One"),
        make_media(602, "Poster Two"),
        make_media(603, "Poster Three"),
    ]
    additional_media = [
        make_media(701, "Anidle Pick"),
        make_media(702, "Synopsis Pick"),
        make_media(703, "Character Pick"),
    ]
    pool = poster_media + additional_media + [
        _media_with_character(800 + i, f"Extra {i}", 900 - i) for i in range(48)
    ]
    media_by_id = {media.id: media for media in pool}

    async def fake_load_popular_pool(day_value, cache, settings):
        assert day_value == day
        return list(pool)

    async def fake_load_media_details(media_id: int, cache, settings):
        return media_by_id[media_id]

    async def fake_build_guess_opening_round(media: Media, cache, **kwargs):
        return make_guess_opening(media, **kwargs)

    def fake_select_poster_candidates(*, day: date, pool, required: int = 3):
        assert required == len(engine.POSTER_ROUNDS)
        return list(poster_media)

    monkeypatch.setattr(engine, "_load_popular_pool", fake_load_popular_pool)
    monkeypatch.setattr(engine, "_load_media_details", fake_load_media_details)
    monkeypatch.setattr(engine, "_build_guess_opening_round", fake_build_guess_opening_round)
    monkeypatch.setattr(engine, "_build_character_guess_game", make_character_silhouette)
    monkeypatch.setattr(engine, "_select_poster_candidates", fake_select_poster_candidates)

    cache = DummyCache()
    result = await engine._assemble_daily_puzzle(
        day,
        user=None,
        include_guess_opening=True,
        cache=cache,
    )

    poster_rounds = result.games.poster_zoomed.puzzle.rounds
    assert len(poster_rounds) == 3
    assert [round.order for round in poster_rounds] == [1, 2, 3]
    assert [round.difficulty for round in poster_rounds] == [
        spec.difficulty for spec in engine.POSTER_ROUNDS
    ]
    poster_media_ids = [round.mediaId for round in poster_rounds]
    assert len(poster_media_ids) == len(set(poster_media_ids))


@pytest.mark.asyncio
async def test_recent_media_records_all_selected(monkeypatch: pytest.MonkeyPatch) -> None:
    day = date(2024, 1, 6)
    popular = [_media_with_character(800 + i, f"Extra {i}", 1000 - i) for i in range(48)]
    media_by_id = {media.id: media for media in popular}

    async def fake_load_popular_pool(day_value, cache, settings):
        return list(popular)

    async def fake_load_media_details(media_id: int, cache, settings):
        return media_by_id.get(media_id) or make_media(media_id, f"Media {media_id}")

    attempts: list[int] = []

    async def fake_build_guess_opening_round(media: Media, cache, **kwargs):
        attempts.append(media.id)
        if len(attempts) == 1:
            return None
        return make_guess_opening(media, **kwargs)

    recorded: list[int] = []

    async def fake_record_recent_media(cache, user_id: int, media_id: int) -> None:
        recorded.append(media_id)

    async def fake_fetch_user_lists(cache, user):
        return None

    async def fake_get_recent_media(cache, user_id: int):
        return []

    monkeypatch.setattr(engine, "_load_popular_pool", fake_load_popular_pool)
    monkeypatch.setattr(engine, "_load_media_details", fake_load_media_details)
    monkeypatch.setattr(engine, "_build_guess_opening_round", fake_build_guess_opening_round)
    monkeypatch.setattr(engine, "_build_character_guess_game", make_character_silhouette)
    monkeypatch.setattr(engine, "_record_recent_media", fake_record_recent_media)
    monkeypatch.setattr(engine, "_fetch_user_lists", fake_fetch_user_lists)
    monkeypatch.setattr(engine, "_get_recent_media", fake_get_recent_media)

    cache = DummyCache()
    user = UserContext(user_id=9, username="tester", access_token="token")
    result = await engine._assemble_daily_puzzle(
        day,
        user=user,
        include_guess_opening=True,
        cache=cache,
    )

    poster_rounds = result.games.poster_zoomed.puzzle.rounds
    assert poster_rounds
    assert len(poster_rounds) == len(engine.POSTER_ROUNDS)
    poster_ids = [round.mediaId for round in poster_rounds]
    assert len(poster_ids) == len(set(poster_ids))

    bundle_ids = [
        result.games.anidle.mediaId,
        *[r.mediaId for r in result.games.redacted_synopsis.puzzle.rounds],
        *[entry.mediaId for r in result.games.character_silhouette.puzzle.rounds for entry in r.entries],
    ]
    bundle_ids.extend(poster_ids)
    if result.games.poster_modified:
        bundle_ids.extend(r.mediaId for r in result.games.poster_modified.puzzle.rounds)
    if result.games.guess_the_opening:
        rounds = result.games.guess_the_opening.puzzle.rounds
        assert len(rounds) == 3
        bundle_ids.extend(round.mediaId for round in rounds)
        assert attempts[-3:] == [round.mediaId for round in rounds]

    assert set(recorded) == set(bundle_ids)
    assert len(recorded) == len(set(bundle_ids))
    assert result.games.character_silhouette is not None
    assert result.games.guess_the_opening is not None
    assert len(attempts) >= 4


def _media_with_character(media_id: int, title: str, popularity: int) -> Media:
    media = make_media(media_id, title)
    media.popularity = popularity
    media.description = f"{title} follows a hero through a long and winding adventure story."
    edge = make_character_edge(media_id)
    media.characters = MediaCharacters(edges=[edge])
    return media


def test_popularity_tiers_split_the_ranking_by_share() -> None:
    ranking = [_media_with_character(i, f"M{i}", popularity=1000 - i) for i in range(10)]
    tiers = engine._popularity_tiers(ranking)
    # Easy is the top fifth, Medium the next 30%, Hard the bottom half.
    assert tiers[1] == {0, 1}
    assert tiers[2] == {2, 3, 4}
    assert tiers[3] == {5, 6, 7, 8, 9}
    # An exhausted tier widens to its neighbour instead of failing.
    picked = engine._tier_candidates(ranking, tiers, 3, excluded_ids={5, 6, 7, 8, 9})
    assert {media.id for media in picked} == {2, 3, 4}


def test_exhausted_pool_never_reuses_excluded_anime() -> None:
    pool = [make_media(i, f"Show {i}") for i in range(3)]
    tiers = engine._popularity_tiers(pool)
    assert engine._tier_candidates(pool, tiers, 1, {0, 1, 2}) == []
    with pytest.raises(ValueError, match="No unused anime"):
        engine._choose_tiered("day", "poster", pool, tiers, 1, {0, 1, 2})
    with pytest.raises(ValueError, match="No unused anime"):
        engine._choose_media_from_pool("day", "game", pool, {0}, attempted_ids={1, 2})


def test_tiered_poster_crops_never_show_the_whole_poster() -> None:
    media = make_media(5, "Poster")
    for difficulty, scales in engine.POSTER_ZOOM_SCALES.items():
        stages = engine._build_poster_crop_stages(media, difficulty)
        assert [stage.scale for stage in stages] == list(scales)
        assert min(stage.scale for stage in stages) > 1.0
    # Legacy (difficulty 0) keeps its final full-poster stage.
    assert engine._build_poster_crop_stages(media)[-1].scale == 1.0


@pytest.mark.asyncio
@pytest.mark.parametrize("day", [date(2024, 2, n) for n in (1, 2, 9, 18, 28)])
async def test_daily_rounds_use_a_different_anime_per_difficulty(monkeypatch: pytest.MonkeyPatch, day: date) -> None:
    popular = [_media_with_character(900 + i, f"Show {i}", popularity=100_000 - i * 500) for i in range(150)]
    for media in popular[::2]:
        media.status = "RELEASING"
    # Airing shows still count toward the other modes, so only openings skip them.
    media_by_id = {media.id: media for media in popular}
    tiers = engine._popularity_tiers(popular)

    async def fake_load_popular_pool(day_value, cache, settings):
        return list(popular)

    async def fake_load_media_details(media_id: int, cache, settings):
        return media_by_id[media_id]

    async def fake_build_guess_opening_round(media: Media, cache, **kwargs):
        return make_guess_opening(media, **kwargs)

    monkeypatch.setattr(engine, "_load_popular_pool", fake_load_popular_pool)
    monkeypatch.setattr(engine, "_load_media_details", fake_load_media_details)
    monkeypatch.setattr(engine, "_build_guess_opening_round", fake_build_guess_opening_round)

    result = await engine._assemble_daily_puzzle(day, user=None, include_guess_opening=True, cache=DummyCache())

    poster = result.games.poster_zoomed.puzzle.rounds
    assert [r.difficulty for r in poster] == [1, 2, 3]
    assert all(r.mediaId in tiers[r.difficulty] for r in poster)
    assert all(r.solution is not None for r in poster)

    synopsis = result.games.redacted_synopsis.puzzle.rounds
    assert [r.difficulty for r in synopsis] == [1, 2, 3]
    assert all(r.mediaId in tiers[r.difficulty] and r.masked_word_indices for r in synopsis)
    assert result.games.redacted_synopsis.puzzle.answer == synopsis[0].answer

    characters = result.games.character_silhouette.puzzle.rounds
    assert [r.difficulty for r in characters] == [1, 2, 3]
    card_media = [entry.mediaId for r in characters for entry in r.entries]
    assert all(len(r.entries) == engine.CHARACTERS_PER_ROUND for r in characters)
    assert len(card_media) == len(set(card_media))
    # Characters always come from popular shows; rounds differ in how the art is hidden.
    assert all(entry.mediaId in tiers[1] for r in characters for entry in r.entries)

    openings = result.games.guess_the_opening.puzzle.rounds
    assert [r.difficulty for r in openings] == [1, 2, 3]
    # Openings use the shared tiers and never pick a show that is still airing.
    assert all(r.mediaId in tiers[r.difficulty] for r in openings)
    assert all(media_by_id[r.mediaId].status != "RELEASING" for r in openings)

    every_round = (
        [result.games.anidle.mediaId]
        + [r.mediaId for r in poster] + [r.mediaId for r in synopsis] + card_media + [r.mediaId for r in openings]
    )
    modified = result.games.poster_modified.puzzle.rounds
    assert [r.difficulty for r in modified] == [1, 2, 3]
    assert all(r.mediaId in tiers[r.difficulty] for r in modified)
    assert {r.meta.modification for r in modified} == {"spotlight", "mosaic", "shuffled"}
    every_round.extend(r.mediaId for r in modified)
    assert len(every_round) == 25
    assert len(every_round) == len(set(every_round))


def test_sequels_are_detected_from_relations() -> None:
    first = make_media(1, "Show")
    sequel = make_media(2, "Show Season 2")
    sequel.relations = {"edges": [{"relationType": "PREQUEL"}, {"relationType": "SEQUEL"}]}
    first.relations = {"edges": [{"relationType": "SEQUEL"}]}
    assert engine._is_sequel(sequel) is True
    assert engine._is_sequel(first) is False
    assert engine._is_sequel(make_media(3, "No relations")) is False


@pytest.mark.asyncio
async def test_opening_rounds_carry_buyable_genre_and_year(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.services import animethemes

    media = make_media(42, "Clip Show")
    media.genres = ["Action", "Drama", "Mystery", "Sci-Fi", "Thriller"]

    async def fake_clip(_variants, *, anilist_id=None):
        return animethemes.OpeningClip(
            title="Clip Show",
            audio_url=None,
            video_url="https://v.example/42.webm",
            song_title="Song",
            artist="Singer",
            sequence=1,
            length_seconds=90,
        )

    monkeypatch.setattr(animethemes, "find_opening_clip", fake_clip)
    opening = await engine._build_guess_opening_round(media, DummyCache(), order=1, total_rounds=3, difficulty=1)
    assert opening is not None
    assert opening.meta.genres == ["Action", "Drama", "Mystery", "Sci-Fi"]
    assert opening.meta.year == 2024
    # The window skips the first and last 20 seconds of a ~90s opening.
    assert 20 <= opening.clip.startSeconds <= 40
    assert opening.clip.endSeconds - opening.clip.startSeconds == 30
    assert opening.clip.endSeconds <= 70


def test_opening_prefers_a_creditless_video_without_lyrics() -> None:
    from app.services import animethemes

    audio = {"link": "https://a.example/op.ogg"}
    payload = {"anime": {"animethemes": [{"type": "OP", "sequence": None, "slug": "OP1", "song": {}, "animethemeentries": [{
        "nsfw": False, "spoiler": False, "videos": [
            {"link": "https://v.example/OP1-Lyrics.webm", "lyrics": True, "nc": False, "subbed": False,
             "overlap": "None", "resolution": 720, "size": 24, "audio": audio},
            {"link": "https://v.example/OP1-NCBD1080.webm", "lyrics": False, "nc": True, "subbed": False,
             "overlap": "None", "resolution": 1080, "size": 37, "audio": audio},
            {"link": "https://v.example/OP1.webm", "lyrics": False, "nc": False, "subbed": False,
             "overlap": "None", "resolution": 720, "size": 29, "audio": audio},
        ]}]}]}}
    clip = animethemes.extract_opening_clip(payload)
    assert clip is not None
    assert clip.video_url == "https://v.example/OP1-NCBD1080.webm"
    assert clip.audio_url == "https://a.example/op.ogg"


def test_featured_character_can_include_the_supporting_cast() -> None:
    media = make_media(1, "Ensemble")
    main = make_character_edge(1)
    supporting = make_character_edge(2)
    supporting.role = "SUPPORTING"
    media.characters = MediaCharacters(edges=[main, supporting])
    # Without a seed the legacy pick is the first main character.
    assert engine._featured_character_edge(media, set()) is main
    mains_only = {engine._featured_character_edge(media, set(), f"s{i}").node.id for i in range(20)}
    assert mains_only == {main.node.id}
    with_supporting = {
        engine._featured_character_edge(media, set(), f"s{i}", include_supporting=True).node.id
        for i in range(20)
    }
    assert with_supporting == {main.node.id, supporting.node.id}


@pytest.mark.asyncio
async def test_popular_pool_keeps_required_pages_when_deeper_pages_fail(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.services import anilist as anilist_service

    async def page(number: int, per_page: int):
        if number > 3:
            raise anilist_service.AniListRateLimited(30)
        media = [make_media(number * 100 + i, f"P{number}-{i}").model_dump(mode="json") for i in range(per_page)]
        return {"pageInfo": {"total": 10 * per_page, "currentPage": number, "hasNextPage": True}, "media": media}

    monkeypatch.setattr(anilist_service, "fetch_popular_page", page)
    pool = await anilist_service.fetch_popular_pool(per_page=2, pages=6, required_pages=2)
    assert [m.id for m in pool] == [100, 101, 200, 201, 300, 301]
    with pytest.raises(anilist_service.AniListRateLimited):
        await anilist_service.fetch_popular_pool(per_page=2, pages=6, required_pages=5)
