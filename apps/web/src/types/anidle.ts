export type ScalarStatus = "match" | "higher" | "lower" | "unknown";

export type ListStatus = "match" | "miss";

export interface ScalarFeedback {
  guess: number | null;
  target: number | null;
  status: ScalarStatus;
  guessSeason?: string | null;
  targetSeason?: string | null;
}

export interface ListFeedbackItem {
  value: string;
  status: ListStatus;
}

export interface AnidleGuessEvaluation {
  title: string;
  correct: boolean;
  year: ScalarFeedback;
  averageScore: ScalarFeedback;
  popularity: ScalarFeedback;
  genres: ListFeedbackItem[];
  tags: ListFeedbackItem[];
  studios: ListFeedbackItem[];
  source: ListFeedbackItem[];
  /** Added in evaluation version 2; absent on older saved guesses. */
  episodes?: ScalarFeedback;
  format?: ListFeedbackItem[];
  /** Cover art of the guessed anime. */
  coverImage?: string | null;
  /** False when the guess matched no known anime (not a spent attempt). */
  matched?: boolean;
}

export interface AnidleGuessHistoryEntry {
  guess: string;
  guessMediaId?: number | null;
  evaluation?: AnidleGuessEvaluation | null;
  evaluationVersion?: number | null;
  evaluatedAt?: string | null;
}

export const CURRENT_ANIDLE_EVALUATION_VERSION = 2;
