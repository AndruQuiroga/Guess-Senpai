"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useAccount } from "./useAccount";
import type { AnidleGuessHistoryEntry } from "../types/anidle";
import { normalizeAnidleEvaluation } from "../utils/normalizeAnidleEvaluation";
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
const STORAGE_KEY_PREFIX = `${STORAGE_KEY}:`;
const COOKIE_KEY = "guesssenpai-progress";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 60; // 60 days
const COOKIE_MAX_DAYS = 45;
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
const FLUSH_DELAY_MS = 1000;
const RETRY_DELAY_MS = 5000;

interface PersistedDailyState {
  progress: DailyProgress;
}

type UsePuzzleProgressValue = {
  progress: DailyProgress;
  recordGame: (game: GameKey, progressState: GameProgress) => void;
  refresh: () => Promise<RefreshResult>;
  isRefreshing: boolean;
  refreshError: ProgressFetchError | null;
};

interface PuzzleProgressContextValue {
  date: string;
  value: UsePuzzleProgressValue;
}

interface PuzzleProgressProviderProps {
  date: string;
  puzzleId?: string;
  rulesVersion?: string;
  initialProgress?: DailyProgress | null;
  children: ReactNode;
}

const PuzzleProgressContext = createContext<PuzzleProgressContextValue | null>(
  null,
);

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

function stableStringify(value: unknown): string {
  if (value === undefined) {
    return "undefined";
  }
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(
        ([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`,
      );
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function areGameProgressEntriesEqual(
  a: GameProgress | undefined,
  b: GameProgress,
): boolean {
  if (!a) {
    return false;
  }
  return stableStringify(a) === stableStringify(b);
}

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

function normalizeAnidleHistoryEntry(
  value: unknown,
): AnidleGuessHistoryEntry | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const rawGuess =
    record.guess ?? record.value ?? record.title ?? record["guessValue"];

  let guess: string | null = null;
  if (typeof rawGuess === "string") {
    const trimmed = rawGuess.trim();
    if (trimmed) {
      guess = trimmed;
    }
  } else if (typeof rawGuess === "number" && Number.isFinite(rawGuess)) {
    guess = String(Math.trunc(rawGuess));
  }

  if (!guess) {
    return null;
  }

  const rawMediaId =
    record.guessMediaId ??
    record.guess_media_id ??
    record.mediaId ??
    record.media_id;
  let guessMediaId: number | null = null;
  if (typeof rawMediaId === "number" && Number.isFinite(rawMediaId)) {
    guessMediaId = Math.trunc(rawMediaId);
  }

  const rawEvaluationVersion =
    record.evaluationVersion ?? record.evaluation_version;
  const evaluationVersion =
    typeof rawEvaluationVersion === "number" &&
    Number.isFinite(rawEvaluationVersion)
      ? Math.trunc(rawEvaluationVersion)
      : undefined;

  const rawEvaluatedAt = record.evaluatedAt ?? record.evaluated_at;
  const evaluatedAt =
    typeof rawEvaluatedAt === "string" && rawEvaluatedAt.trim()
      ? rawEvaluatedAt
      : undefined;

  const rawEvaluation =
    record.evaluation ??
    record.evaluationPayload ??
    record.evaluation_payload ??
    record.feedback;

  const evaluation =
    rawEvaluation === undefined || rawEvaluation === null
      ? undefined
      : (normalizeAnidleEvaluation(rawEvaluation, guess) ?? undefined);

  const entry: AnidleGuessHistoryEntry = {
    guess,
    guessMediaId: guessMediaId ?? null,
  };

  if (evaluationVersion !== undefined) {
    entry.evaluationVersion = evaluationVersion;
  }
  if (evaluatedAt) {
    entry.evaluatedAt = evaluatedAt;
  }
  if (evaluation) {
    entry.evaluation = evaluation;
  }

  return entry;
}

function normalizeAnidleHistory(
  value: unknown,
): { entries: AnidleGuessHistoryEntry[]; hadInput: boolean } | null {
  if (value === undefined) {
    return null;
  }

  if (value === null) {
    return { entries: [], hadInput: true };
  }

  if (Array.isArray(value)) {
    const normalized = value
      .map((entry) => normalizeAnidleHistoryEntry(entry))
      .filter((entry): entry is AnidleGuessHistoryEntry => Boolean(entry));
    return { entries: normalized, hadInput: true };
  }

  if (typeof value === "object") {
    const single = normalizeAnidleHistoryEntry(value);
    return { entries: single ? [single] : [], hadInput: true };
  }

  return { entries: [], hadInput: true };
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
    record.feedbackType ?? (record as Record<string, unknown>)["feedback_type"];
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
    if (lowered === "success" || lowered === "partial" || lowered === "error") {
      normalized.feedbackType = lowered as RoundFeedbackType;
    }
  }

  if (typeof feedbackMessageRaw === "string") {
    const trimmed = feedbackMessageRaw.trim();
    if (trimmed) {
      normalized.feedbackMessage = trimmed;
    }
  }

  // Rounds v3: one scored submission per round.
  const points = coercePositiveInteger(record.points, 0);
  if (points !== undefined) {
    normalized.points = points;
  }
  const hints = coercePositiveInteger(record.hints, 0);
  if (hints !== undefined) {
    normalized.hints = hints;
  }
  if (record.answers && typeof record.answers === "object") {
    normalized.answers = record.answers as Record<string, unknown>;
  }
  if (record.result && typeof record.result === "object") {
    normalized.result = record.result as Record<string, unknown>;
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

  const rawAnidleHistory =
    recordEntries["anidleHistory"] ?? recordEntries["anidle_history"];
  const normalizedHistoryResult = normalizeAnidleHistory(rawAnidleHistory);
  let anidleHistory: AnidleGuessHistoryEntry[] | undefined;

  if (normalizedHistoryResult) {
    if (normalizedHistoryResult.entries.length > 0) {
      anidleHistory = normalizedHistoryResult.entries;
    } else if (normalizedHistoryResult.hadInput) {
      anidleHistory = [];
    }
  }

  if (!anidleHistory && guesses.length > 0) {
    anidleHistory = guesses.map((guess) => ({ guess }));
  }

  const normalized: GameProgress = {
    completed,
    round,
    guesses,
  };

  if (rounds) {
    normalized.rounds = rounds;
  }

  if (anidleHistory !== undefined) {
    normalized.anidleHistory = anidleHistory;
  }

  const attemptLimit = coercePositiveInteger(
    recordEntries["attemptLimit"] ?? recordEntries["attempt_limit"],
    1,
  );
  if (attemptLimit !== undefined) {
    normalized.attemptLimit = attemptLimit;
  }

  const hintsRevealed = coercePositiveInteger(
    recordEntries["hintsRevealed"] ?? recordEntries["hints_revealed"],
    0,
  );
  const anidleHints =
    recordEntries["anidleHints"] ?? recordEntries["anidle_hints"];
  if (Array.isArray(anidleHints)) {
    normalized.anidleHints = anidleHints.filter(
      (value): value is string => typeof value === "string",
    );
  }

  if (hintsRevealed !== undefined) {
    normalized.hintsRevealed = hintsRevealed;
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

function getDateStorageKey(date: string): string {
  return `${STORAGE_KEY_PREFIX}${date}`;
}

function normalizePersistedState(value: unknown): PersistedDailyState | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  if ("progress" in record) {
    return {
      progress: normalizeProgress(record.progress),
    };
  }

  return {
    progress: normalizeProgress(value),
  };
}

function readLocalStorageState(date: string): PersistedDailyState | null {
  if (typeof window === "undefined" || !date) {
    return null;
  }
  try {
    const directKey = getDateStorageKey(date);
    const directValue = window.localStorage.getItem(directKey);
    if (directValue) {
      try {
        const parsed = JSON.parse(directValue);
        const normalized = normalizePersistedState(parsed);
        if (normalized) {
          return normalized;
        }
      } catch (error) {
        console.warn("Failed to parse stored puzzle progress", error);
        window.localStorage.removeItem(directKey);
      }
    }

    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored) as StorageShape;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const entry = parsed[date];
    const normalized = normalizePersistedState(entry);
    if (!normalized) {
      return null;
    }

    try {
      const payload = JSON.stringify({ progress: { ...normalized.progress } });
      window.localStorage.setItem(directKey, payload);
    } catch (error) {
      console.warn(
        "Failed to migrate puzzle progress to optimized storage",
        error,
      );
    }

    try {
      const clonedStore = { ...parsed };
      delete clonedStore[date];
      if (Object.keys(clonedStore).length === 0) {
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clonedStore));
      }
    } catch (error) {
      console.warn("Failed to clean up legacy puzzle progress storage", error);
    }

    return normalized;
  } catch (error) {
    console.warn("Failed to read puzzle progress from localStorage", error);
    return null;
  }
}

function writeLocalStorageState(date: string, value: PersistedDailyState) {
  if (typeof window === "undefined" || !date) return;
  try {
    const directKey = getDateStorageKey(date);
    if (Object.keys(value.progress).length === 0) {
      window.localStorage.removeItem(directKey);
      return;
    }

    const payload = {
      progress: { ...value.progress },
    } satisfies PersistedDailyState;

    window.localStorage.setItem(directKey, JSON.stringify(payload));
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

/** Same-tab signal so read-only views (navigation) can follow progress writes. */
export const PROGRESS_CHANGED_EVENT = "guesssenpai:progress-changed";

function notifyStoredProgressChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PROGRESS_CHANGED_EVENT));
}

function writeStoredState(date: string, value: PersistedDailyState) {
  if (!date) return;
  writeLocalStorageState(date, value);
  writeCookieState(date, value);
}

// A sync response must never replace a more advanced local game. Keep whole
// attempts together rather than fabricating a history by unioning guesses.
export function mergeProgress(
  local: DailyProgress,
  remote: DailyProgress,
  preferRemoteOnTie = false,
): DailyProgress {
  const merged = { ...local };
  const rank = (entry: GameProgress) => [
    Number(entry.completed),
    entry.round,
    entry.rounds?.filter((round) => round.completed).length ?? 0,
    entry.guesses.length +
      (entry.rounds?.reduce((n, round) => n + round.guesses.length, 0) ?? 0),
  ];
  for (const [key, candidate] of Object.entries(remote)) {
    if (!candidate) continue;
    const game = key as GameKey;
    const current = merged[game];
    if (!current) {
      merged[game] = candidate;
      continue;
    }
    const a = rank(current),
      b = rank(candidate);
    const difference = a.findIndex((value, index) => value !== b[index]);
    if (
      (difference >= 0 && b[difference] > a[difference]) ||
      (difference < 0 && preferRemoteOnTie)
    )
      merged[game] = candidate;
  }
  return merged;
}

function usePuzzleProgressController(
  date: string,
  initialProgress?: DailyProgress | null,
  puzzleId = `daily:${date}`,
  rulesVersion = "1",
  userId: number | null = null,
  enabled = true,
): UsePuzzleProgressValue {
  // Guest keys retain the first shared-daily format. Account state is isolated;
  // unowned records are never silently imported into a signed-in account.
  const storageKey = `${date}:${puzzleId}:v${rulesVersion}${userId === null ? "" : `:user:${userId}`}`;
  const [state, setState] = useState<PersistedDailyState>(() => ({
    progress: {},
  }));
  const stateRef = useRef(state);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<ProgressFetchError | null>(
    null,
  );
  const generation = useRef(0);
  const active = useRef(false);
  const pending = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushing = useRef(false);
  const flushRef = useRef<() => Promise<void>>(async () => {});
  const abortRef = useRef<AbortController | null>(null);

  const persist = useCallback(
    (progress: DailyProgress) => {
      const next = { progress };
      stateRef.current = next;
      writeStoredState(storageKey, next);
      setState(next);
      notifyStoredProgressChanged();
    },
    [storageKey],
  );

  const scheduleFlush = useCallback(
    (delay = FLUSH_DELAY_MS) => {
      if (userId === null || !active.current || timer.current) return;
      timer.current = setTimeout(() => {
        timer.current = null;
        void flushRef.current();
      }, delay);
    },
    [userId],
  );

  const flush = useCallback(async () => {
    if (
      !active.current ||
      userId === null ||
      !pending.current ||
      flushing.current
    )
      return;
    const version = generation.current;
    flushing.current = true;
    pending.current = false;
    try {
      const response = await fetch(`${API_BASE}/puzzles/progress`, {
        method: "PUT",
        credentials: "include",
        signal: abortRef.current?.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          puzzle_id: puzzleId,
          rules_version: rulesVersion,
          account_user_id: userId,
          progress: stateRef.current.progress,
        }),
      });
      if (!response.ok) throw new Error("Progress sync failed. Please retry.");
      if (active.current && version === generation.current)
        setRefreshError(null);
    } catch (error) {
      if (active.current && version === generation.current) {
        pending.current = true;
        setRefreshError(error as ProgressFetchError);
      }
    } finally {
      if (version === generation.current) {
        flushing.current = false;
        if (pending.current) scheduleFlush(RETRY_DELAY_MS);
      }
    }
  }, [date, puzzleId, rulesVersion, userId, scheduleFlush]);
  flushRef.current = flush;

  const refresh = useCallback(async (): Promise<RefreshResult> => {
    if (!enabled || !date || !active.current) return { success: false };
    // Guest progress is exclusively local. An empty unauthenticated response
    // must never clear a game, and guest data must never enter an account queue.
    if (userId === null)
      return { success: true, progress: stateRef.current.progress };
    const version = generation.current;
    setIsRefreshing(true);
    setRefreshError(null);
    try {
      const query = new URLSearchParams({
        d: date,
        puzzle_id: puzzleId,
        rules_version: rulesVersion,
        account_user_id: String(userId),
      });
      const response = await fetch(`${API_BASE}/puzzles/progress?${query}`, {
        credentials: "include",
        signal: abortRef.current?.signal,
      });
      if (!response.ok) throw new Error("Unable to refresh saved progress");
      const payload = await response.json();
      if (
        payload.date !== date ||
        payload.puzzle_id !== puzzleId ||
        payload.rules_version !== rulesVersion ||
        payload.account_user_id !== userId
      ) {
        throw new Error(
          "Progress response does not match this account and puzzle",
        );
      }
      if (!active.current || version !== generation.current)
        return { success: false };
      const remote = normalizeProgress(payload.progress);
      const progress = mergeProgress(stateRef.current.progress, remote);
      persist(progress);
      if (stableStringify(progress) !== stableStringify(remote)) {
        pending.current = true;
        scheduleFlush();
      }
      return { success: true, progress };
    } catch (error) {
      if (active.current && version === generation.current)
        setRefreshError(error as ProgressFetchError);
      return { success: false, error: error as ProgressFetchError };
    } finally {
      if (active.current && version === generation.current)
        setIsRefreshing(false);
    }
  }, [date, puzzleId, rulesVersion, userId, enabled, persist, scheduleFlush]);

  useEffect(() => {
    if (!enabled || !date) return;
    active.current = true;
    ++generation.current;
    abortRef.current = new AbortController();
    const local = readStoredState(storageKey);
    const progress = mergeProgress(
      local.progress,
      normalizeProgress(initialProgress),
    );
    stateRef.current = { progress };
    setState({ progress });
    void refresh();
    return () => {
      active.current = false;
      ++generation.current;
      abortRef.current?.abort();
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      pending.current = false;
      flushing.current = false;
      // Local state is already durable. Do not send on unmount: cookies may
      // now belong to another account. Next hydration retries this owner's data.
    };
  }, [enabled, date, storageKey, refresh]);

  const recordGame = useCallback(
    (game: GameKey, progressState: GameProgress) => {
      if (!active.current || !enabled) return;
      const normalized = normalizeGameProgressEntry(progressState);
      if (
        !normalized ||
        areGameProgressEntriesEqual(stateRef.current.progress[game], normalized)
      )
        return;
      const progress = mergeProgress(
        stateRef.current.progress,
        { [game]: normalized },
        true,
      );
      if (
        stableStringify(progress) === stableStringify(stateRef.current.progress)
      )
        return;
      persist(progress);
      pending.current = true;
      scheduleFlush();
    },
    [enabled, persist, scheduleFlush],
  );

  return {
    progress: state.progress,
    recordGame,
    refresh,
    isRefreshing,
    refreshError,
  };
}

function ScopedProgressProvider({
  date,
  puzzleId,
  rulesVersion,
  initialProgress,
  children,
  userId,
}: PuzzleProgressProviderProps & { userId: number | null }) {
  const value = usePuzzleProgressController(
    date,
    initialProgress,
    puzzleId,
    rulesVersion,
    userId,
  );
  const contextValue = useMemo(() => ({ date, value }), [date, value]);
  return (
    <PuzzleProgressContext.Provider value={contextValue}>
      {value.refreshError && (
        <div role="status" className="panel mb-4 p-4">
          Account progress could not sync. Your current game is still open.{" "}
          <button className="button" onClick={() => void value.refresh()}>
            Retry sync
          </button>
        </div>
      )}
      {children}
    </PuzzleProgressContext.Provider>
  );
}

export function PuzzleProgressProvider(props: PuzzleProgressProviderProps) {
  const { account, loading, resolved } = useAccount();
  const userId = account.authenticated ? (account.user?.id ?? null) : null;
  if (loading && !resolved) return <p role="status">Loading saved progress…</p>;
  return (
    <ScopedProgressProvider
      {...props}
      userId={userId}
      key={`${props.date}:${props.puzzleId}:${props.rulesVersion}:${userId ?? "guest"}`}
    />
  );
}

/**
 * Read-only view of the progress that provider-backed pages persist. Used by
 * navigation, which lives outside any PuzzleProgressProvider and must not start
 * its own sync. Returns null until the daily identity and account are known,
 * so callers never claim "new" before they actually know.
 */
export function useStoredDailyProgress(
  daily: { date: string; puzzle_id: string; rules_version: string } | null,
): DailyProgress | null {
  const { account, loading, resolved } = useAccount();
  const userId = account.authenticated ? (account.user?.id ?? null) : null;
  const ready = Boolean(daily) && (!loading || resolved);
  const storageKey = daily
    ? `${daily.date}:${daily.puzzle_id}:v${daily.rules_version}${userId === null ? "" : `:user:${userId}`}`
    : "";
  const [progress, setProgress] = useState<DailyProgress | null>(null);

  useEffect(() => {
    if (!ready || !storageKey) {
      setProgress(null);
      return;
    }
    const read = () => setProgress(readStoredState(storageKey).progress);
    read();
    window.addEventListener(PROGRESS_CHANGED_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(PROGRESS_CHANGED_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, [ready, storageKey]);

  return progress;
}

export function usePuzzleProgress(
  date: string,
  initialProgress?: DailyProgress | null,
) {
  const context = useContext(PuzzleProgressContext);
  const { account, loading } = useAccount();
  const matching = context?.date === date;
  // Always call the hook; a provider appearing later must not change hook order.
  const fallback = usePuzzleProgressController(
    date,
    initialProgress,
    undefined,
    undefined,
    account.authenticated ? (account.user?.id ?? null) : null,
    !matching && !loading,
  );
  return matching ? context.value : fallback;
}
