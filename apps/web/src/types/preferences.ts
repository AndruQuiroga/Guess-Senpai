import type { GameKey } from "./progress";

export type GameDifficultyPreferences = Partial<Record<GameKey, number>>;

export interface UserPreferences {
  difficulty: GameDifficultyPreferences;
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  difficulty: {},
};

export function createDefaultUserPreferences(): UserPreferences {
  return { difficulty: {} };
}
