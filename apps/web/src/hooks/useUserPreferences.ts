"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { createDefaultUserPreferences, type UserPreferences } from "../types/preferences";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

interface PreferencesResponse {
  difficulty_level?: unknown;
}

function mergePreferences(response: PreferencesResponse | null): UserPreferences {
  if (!response || typeof response !== "object") {
    return createDefaultUserPreferences();
  }

  return {
    difficultyLevel: normalizeDifficultyLevel(response.difficulty_level),
  };
}

function normalizeDifficultyLevel(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  const rounded = Math.round(numeric);
  if (Number.isNaN(rounded)) {
    return null;
  }

  return Math.max(1, Math.min(3, rounded));
}

export function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(() =>
    createDefaultUserPreferences(),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const difficultyLevel = useMemo(
    () => preferences.difficultyLevel,
    [preferences.difficultyLevel],
  );

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

  const updateDifficulty = useCallback((level: number) => {
    const roundedLevel = Math.round(level);

    setPreferences((previous) => ({
      ...previous,
      difficultyLevel: normalizeDifficultyLevel(roundedLevel),
    }));

    const submit = async () => {
      try {
        const response = await fetch(`${API_BASE}/profile/preferences`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            difficulty_level: roundedLevel,
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
    };

    void submit();
  }, []);

  return {
    preferences,
    difficultyLevel,
    loading,
    error,
    refresh,
    updateDifficulty,
  };
}
