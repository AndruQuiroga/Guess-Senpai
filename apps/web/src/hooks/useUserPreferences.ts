"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useAccount } from "./useAccount";
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

class PreferencesRequestError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "PreferencesRequestError";
    this.status = status;
  }
}

let refreshPromise: Promise<UserPreferences> | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let unauthorizedAuthState: boolean | null = null;

function clearRefreshTimer(): void {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

function isUnauthorizedLocked(authenticated: boolean): boolean {
  return (
    unauthorizedAuthState !== null &&
    unauthorizedAuthState === authenticated
  );
}

function lockUnauthorized(authenticated: boolean): void {
  unauthorizedAuthState = authenticated;
  clearRefreshTimer();
}

function releaseUnauthorizedIfNeeded(authenticated: boolean): void {
  if (
    unauthorizedAuthState !== null &&
    unauthorizedAuthState !== authenticated
  ) {
    unauthorizedAuthState = null;
  }
}

interface UseUserPreferencesOptions {
  authenticated?: boolean;
}

export function useUserPreferences(options?: UseUserPreferencesOptions) {
  const { account } = useAccount();
  const authenticated =
    options?.authenticated ?? account?.authenticated ?? false;
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
    if (!authenticated) {
      releaseUnauthorizedIfNeeded(authenticated);
      clearRefreshTimer();
      const fallback = createDefaultUserPreferences();
      setPreferences(fallback);
      setLoading(false);
      setError(null);
      return fallback;
    }

    if (isUnauthorizedLocked(authenticated)) {
      const fallback = createDefaultUserPreferences();
      setPreferences(fallback);
      setLoading(false);
      setError(null);
      return fallback;
    }

    setLoading(true);
    setError(null);

    if (!refreshPromise) {
      const request = (async () => {
        const response = await fetch(`${API_BASE}/profile/preferences`, {
          credentials: "include",
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new PreferencesRequestError("Unauthorized", 401);
          }

          throw new PreferencesRequestError(
            `Request failed with status ${response.status}`,
            response.status,
          );
        }

        const payload = (await response.json()) as PreferencesResponse;
        return mergePreferences(payload);
      })();

      refreshPromise = request.finally(() => {
        refreshPromise = null;
      });
    }

    try {
      const next = await refreshPromise;
      const resolved = next ?? createDefaultUserPreferences();
      setPreferences(resolved);
      setLoading(false);
      return resolved;
    } catch (caught) {
      const normalized =
        caught instanceof PreferencesRequestError
          ? caught
          : new PreferencesRequestError(String(caught));

      if (normalized.status === 401) {
        lockUnauthorized(authenticated);
        const fallback = createDefaultUserPreferences();
        setPreferences(fallback);
        setLoading(false);
        setError(null);
        return fallback;
      }

      setError(normalized);
      const fallback = createDefaultUserPreferences();
      setPreferences(fallback);
      setLoading(false);
      return fallback;
    }
  }, [authenticated]);

  useEffect(() => {
    releaseUnauthorizedIfNeeded(authenticated);
    if (!authenticated) {
      const fallback = createDefaultUserPreferences();
      setPreferences(fallback);
      setLoading(false);
      setError(null);
      return () => {
        clearRefreshTimer();
      };
    }

    void refresh();

    return () => {
      clearRefreshTimer();
    };
  }, [authenticated, refresh]);

  const updateDifficulty = useCallback((level: number) => {
    const roundedLevel = Math.round(level);

    setPreferences((previous) => ({
      ...previous,
      difficultyLevel: normalizeDifficultyLevel(roundedLevel),
    }));

    if (!authenticated || isUnauthorizedLocked(authenticated)) {
      return;
    }

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

        if (response.status === 401) {
          lockUnauthorized(authenticated);
          setPreferences(createDefaultUserPreferences());
          setError(null);
          return;
        }

        if (!response.ok) {
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
  }, [authenticated]);

  return {
    preferences,
    difficultyLevel,
    loading,
    error,
    refresh,
    updateDifficulty,
  };
}
