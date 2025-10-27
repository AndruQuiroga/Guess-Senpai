"use client";

import { useCallback, useEffect, useState } from "react";

import type { DailyProgress, GameKey, GameProgress } from "../types/progress";

export type { DailyProgress, GameKey, GameProgress } from "../types/progress";

const STORAGE_KEY = "guesssenpai-progress";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

interface PersistedDailyState {
  progress: DailyProgress;
}

type StorageShape = Record<string, unknown>;

interface ProgressResponse {
  date: string;
  progress: DailyProgress;
}

type ProgressFetchError = Error & { status?: number };

export interface RefreshResult {
  success: boolean;
  progress?: DailyProgress;
  error?: ProgressFetchError;
}

const EMPTY_STATE: PersistedDailyState = { progress: {} };

function cloneState(state: PersistedDailyState | null | undefined): PersistedDailyState {
  if (!state) {
    return { progress: {} };
  }
  return {
    progress: { ...(state.progress ?? {}) },
  };
}

function normalizeProgress(value: unknown): DailyProgress {
  if (!value || typeof value !== "object") {
    return {};
  }
  return { ...(value as DailyProgress) };
}

function readStoredState(date: string): PersistedDailyState {
  if (typeof window === "undefined" || !date) {
    return cloneState(EMPTY_STATE);
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return cloneState(EMPTY_STATE);
    }
    const parsed: StorageShape = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object") {
      return cloneState(EMPTY_STATE);
    }
    const entry = parsed[date];
    if (!entry || typeof entry !== "object") {
      return cloneState(EMPTY_STATE);
    }
    const record = entry as Record<string, unknown>;
    if ("progress" in record) {
      return {
        progress: normalizeProgress(record.progress),
      };
    }
    return {
      progress: normalizeProgress(entry),
    };
  } catch (error) {
    console.warn("Failed to read puzzle progress", error);
    return cloneState(EMPTY_STATE);
  }
}

function writeStoredState(date: string, value: PersistedDailyState) {
  if (typeof window === "undefined" || !date) return;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const parsed: StorageShape = stored ? JSON.parse(stored) : {};
    parsed[date] = {
      progress: { ...value.progress },
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  } catch (error) {
    console.warn("Failed to persist puzzle progress", error);
  }
}

export function usePuzzleProgress(date: string) {
  const [state, setState] = useState<PersistedDailyState>(() => readStoredState(date));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<ProgressFetchError | null>(null);

  useEffect(() => {
    setState(readStoredState(date));
  }, [date]);

  const persist = useCallback(
    (updater: (previous: PersistedDailyState) => PersistedDailyState) => {
      setState((prev) => {
        const base = cloneState(prev);
        const next = updater(base);
        writeStoredState(date, next);
        return next;
      });
    },
    [date],
  );

  const fetchProgressFromServer = useCallback(
    async (signal?: AbortSignal): Promise<DailyProgress | null> => {
      if (!date) {
        return null;
      }

      const response = await fetch(`${API_BASE}/puzzles/progress?d=${date}`, {
        credentials: "include",
        signal,
      });

      if (!response.ok) {
        if (response.status === 401) {
          const authError = new Error("Unauthorized") as ProgressFetchError;
          authError.status = response.status;
          throw authError;
        }
        const statusError = new Error(
          `Request failed with status ${response.status}`,
        ) as ProgressFetchError;
        statusError.status = response.status;
        throw statusError;
      }

      const payload = (await response.json()) as ProgressResponse;
      if (!payload || typeof payload !== "object") {
        return {};
      }

      const serverProgress = payload.progress ?? {};
      persist(() => ({
        progress: serverProgress,
      }));
      return serverProgress;
    },
    [date, persist],
  );

  useEffect(() => {
    if (!date) return;

    const abortController = new AbortController();
    let cancelled = false;

    fetchProgressFromServer(abortController.signal)
      .then((serverProgress) => {
        if (cancelled || !serverProgress) {
          return;
        }
      })
      .catch((error: ProgressFetchError) => {
        if (error?.name === "AbortError") {
          return;
        }
        if (error?.status === 401) {
          return;
        }
        console.warn("Failed to hydrate puzzle progress from server", error);
      });

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [date, fetchProgressFromServer]);

  const pushUpdate = useCallback(
    async (game: GameKey, progressState: GameProgress) => {
      if (!date) return;
      try {
        const response = await fetch(`${API_BASE}/puzzles/progress`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date,
            progress: {
              [game]: progressState,
            },
          }),
        });
        if (!response.ok && response.status !== 401) {
          console.warn(
            "Failed to update puzzle progress on server",
            response.statusText,
          );
        }
      } catch (error) {
        console.warn("Failed to update puzzle progress on server", error);
      }
    },
    [date],
  );

  const recordGame = useCallback(
    (game: GameKey, progressState: GameProgress) => {
      persist((prev) => ({
        progress: { ...prev.progress, [game]: progressState },
      }));
      void pushUpdate(game, progressState);
    },
    [persist, pushUpdate],
  );

  const refresh = useCallback(async (): Promise<RefreshResult> => {
    if (!date) {
      const error = new Error("No date available to refresh progress") as ProgressFetchError;
      setRefreshError(error);
      return { success: false, error };
    }

    setIsRefreshing(true);
    setRefreshError(null);

    try {
      const serverProgress = await fetchProgressFromServer();
      if (!serverProgress) {
        const error = new Error("No remote progress available") as ProgressFetchError;
        setRefreshError(error);
        return { success: false, error };
      }
      return { success: true, progress: serverProgress };
    } catch (error) {
      const normalized =
        error instanceof Error
          ? (error as ProgressFetchError)
          : (new Error(String(error)) as ProgressFetchError);
      setRefreshError(normalized);
      return { success: false, error: normalized };
    } finally {
      setIsRefreshing(false);
    }
  }, [date, fetchProgressFromServer]);

  return {
    progress: state.progress,
    recordGame,
    refresh,
    isRefreshing,
    refreshError,
  };
}
