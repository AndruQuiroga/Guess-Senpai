import type { AnidleGuessHistoryEntry } from "./anidle";

export type GameKey =
  | "anidle"
  | "poster_zoomed"
  | "poster_modified"
  | "redacted_synopsis"
  | "character_silhouette"
  | "guess_the_opening";

export type RoundFeedbackType = "success" | "partial" | "error";

export interface GameRoundProgress {
  round: number;
  guesses: string[];
  titleGuesses?: string[];
  yearGuesses?: number[];
  seasonGuess?: string;
  seasonYearGuess?: number;
  stage?: number;
  completed?: boolean;
  hintUsed?: boolean;
  resolvedAnswer?: string;
  resolvedTitle?: string;
  resolvedYear?: number;
  mediaId?: number;
  posterImageBase?: string;
  posterImageUrl?: string;
  feedbackType?: RoundFeedbackType;
  feedbackMessage?: string;
  /** Rounds v3: points scored by this round's single submission. */
  points?: number;
  /** Rounds v3: hints taken before submitting. */
  hints?: number;
  /** Rounds v3: what the player submitted, keyed by field. */
  answers?: Record<string, unknown>;
  /** Rounds v3: the checked outcome shown on the results screen. */
  result?: Record<string, unknown>;
}

export interface GameProgress {
  /** Available points for the actual rounds, including optional bonuses. */
  maxPoints?: number;
  completed: boolean;
  round: number;
  guesses: string[];
  rounds?: GameRoundProgress[];
  anidleHistory?: AnidleGuessHistoryEntry[];
  /** Accepted-attempt budget (rules v2 Anidle); lets non-game views detect exhaustion. */
  attemptLimit?: number;
  /** Anidle hints the player chose to reveal (rules v2 hints are opt-in). */
  hintsRevealed?: number;
  /** Anidle clue types bought (genres, year, synopsis), each priced. */
  anidleHints?: string[];
}

export type DailyProgress = Partial<Record<GameKey, GameProgress>>;
