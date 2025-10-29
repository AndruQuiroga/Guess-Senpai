export type GameKey =
  | "anidle"
  | "poster_zoomed"
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
}

export interface GameProgress {
  completed: boolean;
  round: number;
  guesses: string[];
  rounds?: GameRoundProgress[];
}

export type DailyProgress = Partial<Record<GameKey, GameProgress>>;
