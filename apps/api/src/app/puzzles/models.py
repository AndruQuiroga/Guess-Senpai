from __future__ import annotations

from datetime import date
from typing import Dict, List, Optional

from pydantic import BaseModel, Field

from ..services.anilist import Title


class RoundSpec(BaseModel):
    difficulty: int
    hints: List[str]


class AnidleHints(BaseModel):
    genres: List[str] = Field(default_factory=list)
    year: Optional[int] = None
    episodes: Optional[int] = None
    duration: Optional[int] = None
    popularity: Optional[int] = None
    average_score: Optional[int] = None


class AnidleGame(BaseModel):
    spec: List[RoundSpec]
    answer: str
    hints: AnidleHints


class PosterZoomMeta(BaseModel):
    genres: List[str] = Field(default_factory=list)
    year: Optional[int] = None
    format: Optional[str] = None


class PosterZoomGame(BaseModel):
    spec: List[RoundSpec]
    answer: str
    image: Optional[str] = None
    meta: PosterZoomMeta


class RedactedSynopsisGame(BaseModel):
    spec: List[RoundSpec]
    answer: str
    text: str
    masked_tokens: List[str] = Field(default_factory=list)


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


class GamesPayload(BaseModel):
    anidle: AnidleGame
    poster_zoomed: PosterZoomGame
    redacted_synopsis: RedactedSynopsisGame
    guess_the_opening: Optional[GuessOpeningGame] = None


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
    mediaId: int
    games: GamesPayload
    solution: SolutionPayload
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
