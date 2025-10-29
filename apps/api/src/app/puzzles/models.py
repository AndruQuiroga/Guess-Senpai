from __future__ import annotations

from datetime import date
from typing import Dict, List, Optional

from pydantic import BaseModel, Field, model_validator

from ..services.anilist import Title


class RoundSpec(BaseModel):
    difficulty: int
    hints: List[str]


class SynopsisHint(BaseModel):
    ratio: float
    text: str


class AnidleHints(BaseModel):
    genres: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    year: Optional[int] = None
    episodes: Optional[int] = None
    duration: Optional[int] = None
    popularity: Optional[int] = None
    average_score: Optional[int] = None
    synopsis: List[SynopsisHint] = Field(default_factory=list)


class AnidleGame(BaseModel):
    spec: List[RoundSpec]
    answer: str
    hints: AnidleHints


class PosterZoomMeta(BaseModel):
    genres: List[str] = Field(default_factory=list)
    year: Optional[int] = None
    format: Optional[str] = None


class PosterCropStage(BaseModel):
    scale: float = 1.0
    offset_x: float = 50.0
    offset_y: float = 50.0


class PosterZoomRound(BaseModel):
    order: int
    difficulty: int
    mediaId: int
    answer: str
    meta: PosterZoomMeta
    cropStages: List[PosterCropStage] = Field(default_factory=list)


class PosterZoomGame(BaseModel):
    spec: List[RoundSpec]
    rounds: List[PosterZoomRound] = Field(default_factory=list)


class RedactedSynopsisSegment(BaseModel):
    text: str
    masked: bool = False


class RedactedSynopsisGame(BaseModel):
    spec: List[RoundSpec]
    answer: str
    text: str
    segments: List[RedactedSynopsisSegment] = Field(default_factory=list)
    masked_word_indices: List[int] = Field(default_factory=list)
    masked_words: List[str] = Field(default_factory=list)


class CharacterSilhouetteRound(BaseModel):
    difficulty: int
    label: str
    filter: str
    description: Optional[str] = None


class CharacterSilhouetteCharacter(BaseModel):
    id: int
    name: str
    image: str
    role: Optional[str] = None


class CharacterGuessReveal(BaseModel):
    label: str
    filter: str = "none"
    description: Optional[str] = None


class CharacterGuessEntry(BaseModel):
    character: CharacterSilhouetteCharacter
    characterAnswer: str
    characterAliases: List[str] = Field(default_factory=list)
    animeAnswer: str
    animeAliases: List[str] = Field(default_factory=list)
    reveal: CharacterGuessReveal


class CharacterGuessRound(BaseModel):
    order: int
    difficulty: int
    entries: List[CharacterGuessEntry] = Field(default_factory=list)


class CharacterSilhouetteGame(BaseModel):
    spec: List[CharacterSilhouetteRound]
    answer: str
    character: CharacterSilhouetteCharacter
    rounds: List[CharacterGuessRound] = Field(default_factory=list)


class OpeningClip(BaseModel):
    audioUrl: Optional[str] = None
    videoUrl: Optional[str] = None
    mimeType: Optional[str] = None
    lengthSeconds: Optional[int] = None


class GuessOpeningMeta(BaseModel):
    songTitle: Optional[str] = None
    artist: Optional[str] = None
    sequence: Optional[int] = None
    season: Optional[str] = None
    roundOrder: Optional[int] = None
    roundTotal: Optional[int] = None


class GuessOpeningRound(BaseModel):
    order: int
    mediaId: int
    spec: List[RoundSpec]
    answer: str
    clip: OpeningClip
    meta: GuessOpeningMeta
    solution: SolutionPayload


class GuessOpeningGame(BaseModel):
    rounds: List[GuessOpeningRound] = Field(default_factory=list)


class AnidlePuzzleBundle(BaseModel):
    mediaId: int
    puzzle: AnidleGame
    solution: SolutionPayload


class PosterZoomPuzzleBundle(BaseModel):
    mediaId: int
    puzzle: PosterZoomGame
    solution: SolutionPayload

    @model_validator(mode="before")
    @classmethod
    def _populate_media_id(cls, values: Dict[str, object]) -> Dict[str, object]:
        media_id = values.get("mediaId")
        if media_id is not None:
            return values

        puzzle = values.get("puzzle")
        rounds: Optional[List[PosterZoomRound]] = None
        if isinstance(puzzle, PosterZoomGame):
            rounds = puzzle.rounds
        elif isinstance(puzzle, dict):
            raw_rounds = puzzle.get("rounds")
            if isinstance(raw_rounds, list):
                rounds = []
                for entry in raw_rounds:
                    if isinstance(entry, PosterZoomRound):
                        rounds.append(entry)
                    elif isinstance(entry, dict) and "mediaId" in entry:
                        rounds.append(PosterZoomRound.model_validate(entry))

        if rounds:
            values["mediaId"] = rounds[0].mediaId
        return values

    @model_validator(mode="after")
    def _align_media_id(self) -> PosterZoomPuzzleBundle:
        if self.puzzle.rounds:
            self.mediaId = self.puzzle.rounds[0].mediaId
        return self


class RedactedSynopsisPuzzleBundle(BaseModel):
    mediaId: int
    puzzle: RedactedSynopsisGame
    solution: SolutionPayload


class CharacterSilhouettePuzzleBundle(BaseModel):
    mediaId: int
    puzzle: CharacterSilhouetteGame
    solution: SolutionPayload


class GuessOpeningPuzzleBundle(BaseModel):
    mediaId: int
    puzzle: GuessOpeningGame
    solution: SolutionPayload


class GamesPayload(BaseModel):
    anidle: AnidlePuzzleBundle
    poster_zoomed: PosterZoomPuzzleBundle
    redacted_synopsis: RedactedSynopsisPuzzleBundle
    character_silhouette: CharacterSilhouettePuzzleBundle
    guess_the_opening: Optional[GuessOpeningPuzzleBundle] = None
    difficulty_level: Optional[int] = None


class SolutionStreamingLink(BaseModel):
    site: str
    url: str


class SolutionPayload(BaseModel):
    titles: Title
    coverImage: Optional[str] = None
    synopsis: Optional[str] = None
    aniListUrl: str
    streamingLinks: List[SolutionStreamingLink] = Field(default_factory=list)


class DailyPuzzleResponse(BaseModel):
    date: date
    games: GamesPayload
    guess_the_opening_enabled: bool = False


class GameProgressPayload(BaseModel):
    completed: bool = False
    round: int = 1
    guesses: List[str] = Field(default_factory=list)


class DailyProgressPayload(BaseModel):
    date: date
    progress: Dict[str, GameProgressPayload] = Field(default_factory=dict)


class StreakPayload(BaseModel):
    count: int = 0
    last_completed: Optional[date] = None


class ProgressHistoryEntry(BaseModel):
    date: date
    completed: int = 0
    total: int = 0


class ProgressAggregate(BaseModel):
    total_games: int = 0
    completed_games: int = 0
    active_days: int = 0


class RecentMediaSummary(BaseModel):
    id: int
    title: Title
    coverImage: Optional[str] = None


class PuzzleStatsPayload(BaseModel):
    streak: StreakPayload
    completion_rate: float = 0.0
    total_games: int = 0
    completed_games: int = 0
    active_days: int = 0
    history: List[ProgressHistoryEntry] = Field(default_factory=list)
    recent_media_ids: List[int] = Field(default_factory=list)
    recent_media: List[RecentMediaSummary] = Field(default_factory=list)
