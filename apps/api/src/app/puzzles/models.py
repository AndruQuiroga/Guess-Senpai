from __future__ import annotations

from datetime import date
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


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


class DailyPuzzleResponse(BaseModel):
    date: date
    mediaId: int
    games: GamesPayload
