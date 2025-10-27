from __future__ import annotations

from datetime import date
from typing import Dict, List, Optional

from pydantic import BaseModel, Field

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


class PosterZoomGame(BaseModel):
    spec: List[RoundSpec]
    answer: str
    image: Optional[str] = None
    meta: PosterZoomMeta
    cropStages: List[PosterCropStage] = Field(default_factory=list)


class RedactedSynopsisGame(BaseModel):
    spec: List[RoundSpec]
    answer: str
    text: str
    masked_tokens: List[str] = Field(default_factory=list)


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


class CharacterSilhouetteGame(BaseModel):
    spec: List[CharacterSilhouetteRound]
    answer: str
    character: CharacterSilhouetteCharacter


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


class GuessOpeningGame(BaseModel):
    spec: List[RoundSpec]
    answer: str
    clip: OpeningClip
    meta: GuessOpeningMeta


class AnidlePuzzleBundle(BaseModel):
    mediaId: int
    puzzle: AnidleGame
    solution: SolutionPayload


class PosterZoomPuzzleBundle(BaseModel):
    mediaId: int
    puzzle: PosterZoomGame
    solution: SolutionPayload


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
