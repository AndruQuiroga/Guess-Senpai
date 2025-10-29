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
}

export interface AnidleGuessHistoryEntry {
  guess: string;
  guessMediaId?: number | null;
  evaluation?: AnidleGuessEvaluation | null;
  evaluationVersion?: number | null;
  evaluatedAt?: string | null;
}

export const CURRENT_ANIDLE_EVALUATION_VERSION = 1;
