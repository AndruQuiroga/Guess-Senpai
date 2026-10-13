from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Annotated, Any, Dict, List, Optional

from pydantic import AfterValidator, AliasChoices, BaseModel, ConfigDict, Field, model_validator

from ..services.anilist import Title


def ensure_utc(value: datetime) -> datetime:
    """Return an aware UTC datetime. SQLite drops tzinfo on read; treat naive values as UTC."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


# Serialises with an explicit offset ("Z") so browsers never parse it as local time.
UtcDatetime = Annotated[datetime, AfterValidator(ensure_utc)]


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


class AnidleRules(BaseModel):
    version: str = "2"
    max_attempts: int = 20
    # Wrong-guess counts at which another hint becomes available. Players
    # choose whether to reveal it; nothing is shown automatically.
    hint_after_incorrect: List[int] = Field(default_factory=lambda: [10, 13, 16])


class AnidleGame(BaseModel):
    spec: List[RoundSpec]
    answer: str
    hints: AnidleHints
    rules: Optional[AnidleRules] = None


class PosterZoomMeta(BaseModel):
    genres: List[str] = Field(default_factory=list)
    year: Optional[int] = None
    season: Optional[str] = None
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
    # Rounds v3: the round's own answer card for the results screen.
    solution: Optional[SolutionPayload] = None


class PosterZoomGame(BaseModel):
    spec: List[RoundSpec]
    rounds: List[PosterZoomRound] = Field(default_factory=list)


class RedactedSynopsisSegment(BaseModel):
    text: str
    masked: bool = False


class RedactedSynopsisRound(BaseModel):
    """One Easy/Medium/Hard synopsis round, each a different anime."""

    order: int
    difficulty: int
    mediaId: int
    answer: str
    segments: List[RedactedSynopsisSegment] = Field(default_factory=list)
    # Masked word indices in the order hints reveal them (title words last).
    masked_word_indices: List[int] = Field(default_factory=list)
    solution: SolutionPayload


class RedactedSynopsisGame(BaseModel):
    spec: List[RoundSpec]
    answer: str
    text: str
    segments: List[RedactedSynopsisSegment] = Field(default_factory=list)
    masked_word_indices: List[int] = Field(default_factory=list)
    masked_words: List[str] = Field(default_factory=list)
    rounds: List[RedactedSynopsisRound] = Field(default_factory=list)


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
    # Rounds v3: each card can come from a different anime.
    mediaId: Optional[int] = None
    animeCover: Optional[str] = None


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
    # Playable window; the player never exposes anything outside it.
    startSeconds: Optional[float] = None
    endSeconds: Optional[float] = None


class GuessOpeningMeta(BaseModel):
    songTitle: Optional[str] = None
    artist: Optional[str] = None
    sequence: Optional[int] = None
    season: Optional[str] = None
    roundOrder: Optional[int] = None
    roundTotal: Optional[int] = None


class GuessOpeningRound(BaseModel):
    order: int
    difficulty: Optional[int] = None
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


class AnidlePracticeResponse(BaseModel):
    """A throwaway Unlimited Anidle game. Never published or stored server side."""

    practice_id: str
    rules_version: str = "2"
    anidle: AnidlePuzzleBundle


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
    puzzle_id: str
    rules_version: str
    reset_at: UtcDatetime
    available_modes: List[str] = Field(default_factory=list)
    mode_puzzle_ids: Dict[str, str] = Field(default_factory=dict)
    games: GamesPayload
    guess_the_opening_enabled: bool = False


class GameRoundProgressPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    round: int = 1
    guesses: List[str] = Field(default_factory=list)
    stage: Optional[int] = None
    completed: Optional[bool] = None
    hint_used: Optional[bool] = Field(
        default=None,
        validation_alias=AliasChoices("hintUsed", "hint_used"),
        serialization_alias="hintUsed",
    )
    resolved_answer: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("resolvedAnswer", "resolved_answer"),
        serialization_alias="resolvedAnswer",
    )
    title_guesses: List[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("titleGuesses", "title_guesses"),
        serialization_alias="titleGuesses",
    )
    year_guesses: List[int] = Field(
        default_factory=list,
        validation_alias=AliasChoices("yearGuesses", "year_guesses"),
        serialization_alias="yearGuesses",
    )
    resolved_title: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("resolvedTitle", "resolved_title"),
        serialization_alias="resolvedTitle",
    )
    resolved_year: Optional[int] = Field(
        default=None,
        validation_alias=AliasChoices("resolvedYear", "resolved_year"),
        serialization_alias="resolvedYear",
    )
    # Rounds v3 (one submission per round): what was played and what it scored.
    points: Optional[int] = Field(default=None, ge=0)
    hints: Optional[int] = Field(default=None, ge=0)
    answers: Optional[Dict[str, Any]] = None
    result: Optional[Dict[str, Any]] = None

    @model_validator(mode="after")
    def _normalize(self) -> "GameRoundProgressPayload":
        try:
            self.round = max(int(self.round or 1), 1)
        except (TypeError, ValueError):
            self.round = 1

        normalized_guesses: List[str] = []
        for guess in self.guesses:
            if isinstance(guess, bool):
                continue
            text: Optional[str]
            if isinstance(guess, (int, float)):
                text = str(int(guess))
            elif isinstance(guess, str):
                text = guess
            else:
                text = None
            if not text:
                continue
            normalized = text.strip()
            if normalized:
                normalized_guesses.append(normalized)
        self.guesses = normalized_guesses

        normalized_titles: List[str] = []
        source_titles = self.title_guesses or self.guesses
        for guess in source_titles:
            if isinstance(guess, bool):
                continue
            text = str(guess).strip() if isinstance(guess, (str, int)) else None
            if text:
                normalized_titles.append(text)
        self.title_guesses = normalized_titles or list(self.guesses)

        normalized_years: List[int] = []
        for guess in self.year_guesses:
            if isinstance(guess, bool):
                continue
            if isinstance(guess, int):
                normalized_years.append(guess)
                continue
            try:
                parsed = int(str(guess).strip())
            except (TypeError, ValueError):
                continue
            normalized_years.append(parsed)
        self.year_guesses = normalized_years

        if self.stage is not None:
            try:
                self.stage = max(int(self.stage), 1)
            except (TypeError, ValueError):
                self.stage = None

        if self.resolved_year is not None:
            try:
                self.resolved_year = int(self.resolved_year)
            except (TypeError, ValueError):
                self.resolved_year = None

        return self


class AnidleGuessHistoryEntryPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    guess: str
    guess_media_id: Optional[int] = Field(
        default=None,
        validation_alias=AliasChoices("guess_media_id", "guessMediaId"),
        serialization_alias="guessMediaId",
    )
    evaluation: Optional[Dict[str, Any]] = None
    evaluation_version: Optional[int] = Field(
        default=None,
        validation_alias=AliasChoices("evaluation_version", "evaluationVersion"),
        serialization_alias="evaluationVersion",
    )
    evaluated_at: Optional[datetime] = Field(
        default=None,
        validation_alias=AliasChoices("evaluated_at", "evaluatedAt"),
        serialization_alias="evaluatedAt",
    )

    @model_validator(mode="after")
    def _normalize(self) -> "AnidleGuessHistoryEntryPayload":
        if isinstance(self.guess, str):
            self.guess = self.guess.strip()
        else:
            try:
                self.guess = str(self.guess).strip()
            except Exception:
                self.guess = ""

        if not self.guess:
            self.guess = ""

        media_id = self.guess_media_id
        if isinstance(media_id, bool):
            media_id = None
        if isinstance(media_id, (int, float)):
            try:
                media_id = int(media_id)
            except (TypeError, ValueError):
                media_id = None
        elif media_id is not None:
            try:
                media_id = int(str(media_id))
            except (TypeError, ValueError):
                media_id = None
        self.guess_media_id = media_id

        if self.evaluation_version is not None:
            try:
                self.evaluation_version = int(self.evaluation_version)
            except (TypeError, ValueError):
                self.evaluation_version = None

        return self


class GameProgressPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    completed: bool = False
    round: int = 1
    guesses: List[str] = Field(default_factory=list)
    rounds: Optional[List[GameRoundProgressPayload]] = Field(
        default=None,
        validation_alias=AliasChoices("rounds", "round_progress", "rounds_progress"),
        serialization_alias="rounds",
    )
    anidle_history: Optional[List[AnidleGuessHistoryEntryPayload]] = Field(
        default=None,
        validation_alias=AliasChoices("anidle_history", "anidleHistory"),
        serialization_alias="anidleHistory",
    )
    attempt_limit: Optional[int] = Field(
        default=None,
        ge=1,
        validation_alias=AliasChoices("attempt_limit", "attemptLimit"),
        serialization_alias="attemptLimit",
    )
    hints_revealed: Optional[int] = Field(
        default=None,
        ge=0,
        validation_alias=AliasChoices("hints_revealed", "hintsRevealed"),
        serialization_alias="hintsRevealed",
    )

    @model_validator(mode="after")
    def _normalize(self) -> "GameProgressPayload":
        try:
            self.round = max(int(self.round or 1), 1)
        except (TypeError, ValueError):
            self.round = 1

        normalized_guesses: List[str] = []
        for guess in self.guesses:
            if isinstance(guess, bool):
                continue
            text: Optional[str]
            if isinstance(guess, (int, float)):
                text = str(int(guess))
            elif isinstance(guess, str):
                text = guess
            else:
                text = None
            if not text:
                continue
            normalized = text.strip()
            if normalized:
                normalized_guesses.append(normalized)
        self.guesses = normalized_guesses

        raw_rounds = self.rounds
        normalized_rounds: List[GameRoundProgressPayload] = []
        if isinstance(raw_rounds, list):
            for entry in raw_rounds:
                if isinstance(entry, GameRoundProgressPayload):
                    normalized_rounds.append(entry)
                    continue
                if isinstance(entry, dict):
                    try:
                        normalized_rounds.append(
                            GameRoundProgressPayload.model_validate(entry)
                        )
                    except Exception:
                        continue
        elif raw_rounds is not None:
            try:
                normalized_rounds.append(
                    GameRoundProgressPayload.model_validate(raw_rounds)
                )
            except Exception:
                pass

        if normalized_rounds:
            self.rounds = normalized_rounds
        elif isinstance(raw_rounds, list) and len(raw_rounds) > 0:
            self.rounds = []
        else:
            self.rounds = None

        raw_history = self.anidle_history
        normalized_history: List[AnidleGuessHistoryEntryPayload] = []
        if isinstance(raw_history, list):
            for entry in raw_history:
                if isinstance(entry, AnidleGuessHistoryEntryPayload):
                    if entry.guess:
                        normalized_history.append(entry)
                    continue
                if isinstance(entry, dict):
                    try:
                        parsed = AnidleGuessHistoryEntryPayload.model_validate(
                            entry
                        )
                    except Exception:
                        continue
                    if parsed.guess:
                        normalized_history.append(parsed)
        elif raw_history is not None:
            try:
                parsed = AnidleGuessHistoryEntryPayload.model_validate(raw_history)
                if parsed.guess:
                    normalized_history.append(parsed)
            except Exception:
                pass

        if normalized_history:
            self.anidle_history = normalized_history
        elif isinstance(raw_history, list) and len(raw_history) > 0:
            self.anidle_history = []
        else:
            self.anidle_history = None

        if (self.anidle_history is None or len(self.anidle_history) == 0) and self.guesses:
            generated_history: List[AnidleGuessHistoryEntryPayload] = []
            for guess in self.guesses:
                if isinstance(guess, str):
                    text = guess.strip()
                else:
                    try:
                        text = str(guess).strip()
                    except Exception:
                        text = ""
                if text:
                    generated_history.append(
                        AnidleGuessHistoryEntryPayload(guess=text)
                    )
            if generated_history:
                self.anidle_history = generated_history

        return self


class DailyProgressPayload(BaseModel):
    date: date
    puzzle_id: Optional[str] = None
    rules_version: Optional[str] = None
    account_user_id: Optional[int] = None
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
