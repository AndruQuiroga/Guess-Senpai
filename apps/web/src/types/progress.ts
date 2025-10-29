export type GameKey =
  | "anidle"
  | "poster_zoomed"
  | "redacted_synopsis"
  | "character_silhouette"
  | "guess_the_opening";

export interface GameRoundProgress {
  round: number;
  guesses: string[];
  titleGuesses?: string[];
  yearGuesses?: number[];
  stage?: number;
  completed?: boolean;
  hintUsed?: boolean;
  resolvedAnswer?: string;
  resolvedTitle?: string;
  resolvedYear?: number;
}

export interface GameProgress {
  completed: boolean;
  round: number;
  guesses: string[];
  rounds?: GameRoundProgress[];
}

export type DailyProgress = Partial<Record<GameKey, GameProgress>>;
