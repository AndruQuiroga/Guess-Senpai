export type GameKey =
  | "anidle"
  | "poster_zoomed"
  | "redacted_synopsis"
  | "character_silhouette"
  | "guess_the_opening";

export interface GameProgress {
  completed: boolean;
  round: number;
  guesses: string[];
}

export type DailyProgress = Partial<Record<GameKey, GameProgress>>;
export type DailyDifficultySelections = Partial<Record<GameKey, number>>;
