export interface UserPreferences {
  difficultyLevel: number | null;
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  difficultyLevel: null,
};

export function createDefaultUserPreferences(): UserPreferences {
  return { difficultyLevel: null };
}
