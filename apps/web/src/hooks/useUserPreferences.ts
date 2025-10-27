"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { GameKey } from "../types/progress";
import {
  createDefaultUserPreferences,
  type GameDifficultyPreferences,
  type UserPreferences,
} from "../types/preferences";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

interface PreferencesResponse {
  difficulty?: Record<string, unknown>;
}

function normalizeDifficulty(
  value: PreferencesResponse["difficulty"],
): GameDifficultyPreferences {
  if (!value || typeof value !== "object") {
    return {};
  }

  const normalized: GameDifficultyPreferences = {};
  for (const [key, raw] of Object.entries(value)) {
    const level = Number(raw);
    if (!Number.isFinite(level)) {
      continue;
    }
    normalized[key as GameKey] = Math.round(level);
  }

  return normalized;
}

function mergePreferences(response: PreferencesResponse | null): UserPreferences {
  if (!response || typeof response !== "object") {
    return createDefaultUserPreferences();
  }

  return {
    difficulty: normalizeDifficulty(response.difficulty),
  };
}

export function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(() =>
    createDefaultUserPreferences(),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const difficulty = useMemo(() => preferences.difficulty, [preferences.difficulty]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/profile/preferences`, {
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 401) {
          const fallback = createDefaultUserPreferences();
          setPreferences(fallback);
          setLoading(false);
          return fallback;
        }

        throw new Error(`Request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as PreferencesResponse;
      const next = mergePreferences(payload);
      setPreferences(next);
      setLoading(false);
      return next;
    } catch (caught) {
      const normalized =
        caught instanceof Error ? caught : new Error(String(caught));
      setError(normalized);
      const fallback = createDefaultUserPreferences();
      setPreferences(fallback);
      setLoading(false);
      return fallback;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updateDifficulty = useCallback(
    async (game: GameKey, level: number) => {
      const roundedLevel = Math.round(level);

      setPreferences((previous) => ({
        ...previous,
        difficulty: {
          ...previous.difficulty,
          [game]: roundedLevel,
        },
      }));

      try {
        const response = await fetch(`${API_BASE}/profile/preferences`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            difficulty: {
              [game]: roundedLevel,
            },
          }),
        });

        if (!response.ok && response.status !== 401) {
          console.warn(
            "Failed to update difficulty preference on server",
            response.statusText,
          );
        }
      } catch (caught) {
        console.warn("Failed to update difficulty preference on server", caught);
      }
    },
    [],
  );

  return {
    preferences,
    difficulty,
    loading,
    error,
    refresh,
    updateDifficulty,
  };
}
