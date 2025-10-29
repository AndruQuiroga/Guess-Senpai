"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  DailyProgress,
  GameKey,
  GameProgress,
  GameRoundProgress,
  RoundFeedbackType,
} from "../types/progress";

export type {
  DailyProgress,
  GameKey,
  GameProgress,
  GameRoundProgress,
  RoundFeedbackType,
} from "../types/progress";

const STORAGE_KEY = "guesssenpai-progress";
const COOKIE_KEY = "guesssenpai-progress";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 60; // 60 days
const COOKIE_MAX_DAYS = 45;
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
const FLUSH_DELAY_MS = 1000;
const RETRY_DELAY_MS = 5000;

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

function coerceInteger(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function coercePositiveInteger(
  value: unknown,
  minimum = 1,
): number | undefined {
  const parsed = coerceInteger(value);
  if (parsed === undefined) {
    return undefined;
  }
  return Math.max(minimum, parsed);
}

function normalizeGuessList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const result: string[] = [];
  for (const entry of value) {
    if (typeof entry === "string") {
      const trimmed = entry.trim();
      if (trimmed) {
        result.push(trimmed);
      }
    } else if (typeof entry === "number" && Number.isFinite(entry)) {
      result.push(String(Math.trunc(entry)));
    }
  }
  return result;
}

function normalizeYearGuessList(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const result: number[] = [];
  for (const entry of value) {
    if (typeof entry === "number" && Number.isFinite(entry)) {
      result.push(Math.trunc(entry));
    } else if (typeof entry === "string") {
      const trimmed = entry.trim();
      if (!trimmed) continue;
      const parsed = Number.parseInt(trimmed, 10);
      if (Number.isFinite(parsed)) {
        result.push(parsed);
      }
    }
  }
  return result;
}

function normalizeGameRoundProgress(value: unknown): GameRoundProgress | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const round = coercePositiveInteger(record.round, 1) ?? 1;
  const guesses = normalizeGuessList(record.guesses);
  const rawTitleGuesses =
    record.titleGuesses ?? (record as Record<string, unknown>)["title_guesses"];
  const titleGuessesSource =
    Array.isArray(rawTitleGuesses) && rawTitleGuesses.length > 0
      ? rawTitleGuesses
      : guesses;
  const titleGuesses = normalizeGuessList(titleGuessesSource);
  const yearGuesses = normalizeYearGuessList(
    record.yearGuesses ?? (record as Record<string, unknown>)["year_guesses"],
  );
  const stage = coercePositiveInteger(record.stage, 1);

  let completed: boolean | undefined;
  if (typeof record.completed === "boolean") {
    completed = record.completed;
  }

  let hintUsed: boolean | undefined;
  if (typeof record.hintUsed === "boolean") {
    hintUsed = record.hintUsed;
  } else if (
    typeof (record as Record<string, unknown>)["hint_used"] === "boolean"
  ) {
    hintUsed = Boolean((record as Record<string, unknown>)["hint_used"]);
  }

  const resolvedAnswer =
    typeof record.resolvedAnswer === "string"
      ? record.resolvedAnswer
      : typeof (record as Record<string, unknown>)["resolved_answer"] ===
          "string"
        ? String((record as Record<string, unknown>)["resolved_answer"])
        : undefined;
  const resolvedTitle =
    typeof record.resolvedTitle === "string"
      ? record.resolvedTitle
      : typeof (record as Record<string, unknown>)["resolved_title"] ===
          "string"
        ? String((record as Record<string, unknown>)["resolved_title"])
        : undefined;
  const resolvedYear =
    coerceInteger(record.resolvedYear) ??
    coerceInteger((record as Record<string, unknown>)["resolved_year"]);
  const seasonGuessRaw =
    record.seasonGuess ?? (record as Record<string, unknown>)["season_guess"];
  const seasonYearGuess =
    coerceInteger(record.seasonYearGuess) ??
    coerceInteger((record as Record<string, unknown>)["season_year_guess"]);
  const mediaId =
    coerceInteger(record.mediaId) ??
    coerceInteger((record as Record<string, unknown>)["media_id"]);
  const posterImageBaseRaw =
    typeof record.posterImageBase === "string"
      ? record.posterImageBase
      : typeof (record as Record<string, unknown>)["poster_image_base"] ===
          "string"
        ? String((record as Record<string, unknown>)["poster_image_base"])
        : undefined;
  const posterImageUrlRaw =
    typeof record.posterImageUrl === "string"
      ? record.posterImageUrl
      : typeof (record as Record<string, unknown>)["poster_image_url"] ===
          "string"
        ? String((record as Record<string, unknown>)["poster_image_url"])
        : undefined;
  const feedbackTypeRaw =
    record.feedbackType ??
    (record as Record<string, unknown>)["feedback_type"];
  const feedbackMessageRaw =
    record.feedbackMessage ??
    (record as Record<string, unknown>)["feedback_message"];

  const normalized: GameRoundProgress = {
    round,
    guesses,
  };

  if (titleGuesses.length > 0) {
    normalized.titleGuesses = titleGuesses;
  } else if (guesses.length > 0) {
    normalized.titleGuesses = [...guesses];
  }

  if (yearGuesses.length > 0) {
    normalized.yearGuesses = yearGuesses;
  }

  if (stage !== undefined) {
    normalized.stage = stage;
  }

  if (completed !== undefined) {
    normalized.completed = completed;
  }

  if (hintUsed !== undefined) {
    normalized.hintUsed = hintUsed;
  }

  if (resolvedAnswer && resolvedAnswer.trim()) {
    normalized.resolvedAnswer = resolvedAnswer;
  }

  if (resolvedTitle && resolvedTitle.trim()) {
    normalized.resolvedTitle = resolvedTitle;
  }

  if (resolvedYear !== undefined) {
    normalized.resolvedYear = resolvedYear;
  }

  if (typeof seasonGuessRaw === "string") {
    const trimmed = seasonGuessRaw.trim();
    if (trimmed) {
      normalized.seasonGuess = trimmed.toUpperCase();
    }
  }

  if (seasonYearGuess !== undefined) {
    normalized.seasonYearGuess = seasonYearGuess;
  }

  if (mediaId !== undefined) {
    normalized.mediaId = mediaId;
  }

  if (typeof posterImageBaseRaw === "string") {
    const trimmed = posterImageBaseRaw.trim();
    if (trimmed) {
      normalized.posterImageBase = trimmed;
    }
  }

  if (typeof posterImageUrlRaw === "string") {
    const trimmed = posterImageUrlRaw.trim();
    if (trimmed) {
      normalized.posterImageUrl = trimmed;
    }
  }

  if (typeof feedbackTypeRaw === "string") {
    const lowered = feedbackTypeRaw.trim().toLowerCase();
    if (
      lowered === "success" ||
      lowered === "partial" ||
      lowered === "error"
    ) {
      normalized.feedbackType = lowered as RoundFeedbackType;
    }
  }

  if (typeof feedbackMessageRaw === "string") {
    const trimmed = feedbackMessageRaw.trim();
    if (trimmed) {
      normalized.feedbackMessage = trimmed;
    }
  }

  return normalized;
}

function normalizeGameProgressEntry(value: unknown): GameProgress | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  let completed = false;
  if (typeof record.completed === "boolean") {
    completed = record.completed;
  } else if (typeof record.completed === "number") {
    completed = record.completed > 0;
  } else if (typeof record.completed === "string") {
    completed = record.completed.trim().toLowerCase() === "true";
  }

  const round = coercePositiveInteger(record.round, 1) ?? 1;
  const guesses = normalizeGuessList(record.guesses);

  let rounds: GameRoundProgress[] | undefined;
  const recordEntries = record as Record<string, unknown>;
  const rawRounds =
    recordEntries["rounds"] ??
    recordEntries["round_progress"] ??
    recordEntries["roundProgress"];
  if (Array.isArray(rawRounds)) {
    const normalizedRounds = rawRounds
      .map((entry) => normalizeGameRoundProgress(entry))
      .filter((entry): entry is GameRoundProgress => entry !== null);
    if (normalizedRounds.length > 0) {
      rounds = normalizedRounds;
    } else if (rawRounds.length > 0) {
      rounds = [];
    }
  } else if (rawRounds && typeof rawRounds === "object") {
    const normalized = normalizeGameRoundProgress(rawRounds);
    if (normalized) {
      rounds = [normalized];
    }
  }

  const normalized: GameProgress = {
    completed,
    round,
    guesses,
  };

  if (rounds) {
    normalized.rounds = rounds;
  }

  return normalized;
}

function normalizeProgress(value: unknown): DailyProgress {
  if (!value || typeof value !== "object") {
    return {};
  }
  const result: DailyProgress = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!key) continue;
    const normalized = normalizeGameProgressEntry(entry);
    if (normalized) {
      result[key as keyof DailyProgress] = normalized;
    }
  }
  return result;
}

function cloneState(
  state: PersistedDailyState | null | undefined,
): PersistedDailyState {
  if (!state) {
    return { progress: {} };
  }
  return {
    progress: normalizeProgress(state.progress),
  };
}

function readLocalStorageState(date: string): PersistedDailyState | null {
  if (typeof window === "undefined" || !date) {
    return null;
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }
    const parsed: StorageShape = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const entry = parsed[date];
    if (!entry || typeof entry !== "object") {
      return null;
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
    console.warn("Failed to read puzzle progress from localStorage", error);
    return null;
  }
}

function writeLocalStorageState(date: string, value: PersistedDailyState) {
  if (typeof window === "undefined" || !date) return;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const parsed: StorageShape = stored ? JSON.parse(stored) : {};
    if (Object.keys(value.progress).length === 0) {
      delete parsed[date];
    } else {
      parsed[date] = {
        progress: { ...value.progress },
      };
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  } catch (error) {
    console.warn("Failed to persist puzzle progress to localStorage", error);
  }
}

function readProgressCookie(): StorageShape {
  if (typeof document === "undefined") {
    return {};
  }

  const all = document.cookie ? document.cookie.split("; ") : [];
  const target = all.find((entry) => entry.startsWith(`${COOKIE_KEY}=`));
  if (!target) {
    return {};
  }

  const [, rawValue] = target.split("=");
  if (!rawValue) {
    return {};
  }

  try {
    const decoded = decodeURIComponent(rawValue);
    const parsed = JSON.parse(decoded) as StorageShape;
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch (error) {
    console.warn("Failed to parse puzzle progress cookie", error);
  }
  return {};
}

function writeProgressCookie(store: StorageShape) {
  if (typeof document === "undefined") return;
  try {
    const serialized = encodeURIComponent(JSON.stringify(store));
    document.cookie = `${COOKIE_KEY}=${serialized}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
  } catch (error) {
    console.warn("Failed to persist puzzle progress cookie", error);
  }
}

function readCookieState(date: string): PersistedDailyState | null {
  if (typeof document === "undefined" || !date) {
    return null;
  }
  const store = readProgressCookie();
  const entry = store[date];
  if (!entry || typeof entry !== "object") {
    return null;
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
}

function writeCookieState(date: string, value: PersistedDailyState) {
  if (typeof document === "undefined" || !date) return;
  const store = readProgressCookie();
  if (Object.keys(value.progress).length === 0) {
    delete store[date];
  } else {
    store[date] = {
      progress: { ...value.progress },
    };
  }
  const keys = Object.keys(store)
    .filter((key) => typeof key === "string" && key)
    .sort((a, b) => (a > b ? -1 : 1));
  if (keys.length > COOKIE_MAX_DAYS) {
    for (const staleKey of keys.slice(COOKIE_MAX_DAYS)) {
      delete store[staleKey];
    }
  }
  writeProgressCookie(store);
}

function readStoredState(date: string): PersistedDailyState {
  const localState = readLocalStorageState(date);
  if (localState) {
    return cloneState(localState);
  }

  const cookieState = readCookieState(date);
  if (cookieState) {
    // Keep localStorage in sync when available.
    writeLocalStorageState(date, cookieState);
    return cloneState(cookieState);
  }

  return cloneState(EMPTY_STATE);
}

function writeStoredState(date: string, value: PersistedDailyState) {
  if (!date) return;
  writeLocalStorageState(date, value);
  writeCookieState(date, value);
}

export function usePuzzleProgress(date: string) {
  const [state, setState] = useState<PersistedDailyState>(() =>
    readStoredState(date),
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<ProgressFetchError | null>(
    null,
  );

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
      const normalized = normalizeProgress(serverProgress);
      persist(() => ({
        progress: normalized,
      }));
      return normalized;
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

  const pendingUpdatesRef = useRef<DailyProgress>({});
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushUpdatesToServer = useCallback(
    async (updates: DailyProgress): Promise<boolean> => {
      if (!date || Object.keys(updates).length === 0) {
        return true;
      }

      try {
        const normalizedUpdates = normalizeProgress(updates);
        const response = await fetch(`${API_BASE}/puzzles/progress`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date,
            progress: normalizedUpdates,
          }),
        });

        if (!response.ok) {
          if (response.status === 401) {
            return true;
          }
          console.warn(
            "Failed to update puzzle progress on server",
            response.statusText,
          );
          return false;
        }

        return true;
      } catch (error) {
        console.warn("Failed to update puzzle progress on server", error);
        return false;
      }
    },
    [date],
  );

  const flushPendingUpdates = useCallback(async () => {
    if (!date) {
      pendingUpdatesRef.current = {};
      flushTimerRef.current = null;
      return;
    }

    const updates = pendingUpdatesRef.current;
    pendingUpdatesRef.current = {};
    flushTimerRef.current = null;

    if (Object.keys(updates).length === 0) {
      return;
    }

    const wasSuccessful = await pushUpdatesToServer(updates);
    if (!wasSuccessful) {
      pendingUpdatesRef.current = {
        ...updates,
        ...pendingUpdatesRef.current,
      };

      if (!flushTimerRef.current) {
        flushTimerRef.current = setTimeout(() => {
          void flushPendingUpdates();
        }, RETRY_DELAY_MS);
      }
    }
  }, [date, pushUpdatesToServer]);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current) {
      return;
    }

    flushTimerRef.current = setTimeout(() => {
      void flushPendingUpdates();
    }, FLUSH_DELAY_MS);
  }, [flushPendingUpdates]);

  useEffect(() => {
    return () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }

      const pending = pendingUpdatesRef.current;
      pendingUpdatesRef.current = {};

      if (date && Object.keys(pending).length > 0) {
        void pushUpdatesToServer(pending);
      }
    };
  }, [date, pushUpdatesToServer]);

  const recordGame = useCallback(
    (game: GameKey, progressState: GameProgress) => {
      const normalized = normalizeGameProgressEntry(progressState);
      if (!normalized) {
        return;
      }

      persist((prev) => ({
        progress: { ...prev.progress, [game]: normalized },
      }));
      pendingUpdatesRef.current = {
        ...pendingUpdatesRef.current,
        [game]: normalized,
      };
      scheduleFlush();
    },
    [persist, scheduleFlush],
  );

  const refresh = useCallback(async (): Promise<RefreshResult> => {
    if (!date) {
      const error = new Error(
        "No date available to refresh progress",
      ) as ProgressFetchError;
      setRefreshError(error);
      return { success: false, error };
    }

    setIsRefreshing(true);
    setRefreshError(null);

    try {
      const serverProgress = await fetchProgressFromServer();
      if (!serverProgress) {
        const error = new Error(
          "No remote progress available",
        ) as ProgressFetchError;
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
