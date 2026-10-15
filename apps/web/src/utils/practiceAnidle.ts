import type { GameProgress } from "../types/progress";
import type { AnidleGame } from "../types/puzzles";

/*
 * Unlimited Anidle is practice: nothing here touches daily progress, the
 * streak, the daily score or the account. It has its own localStorage keys.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export const PRACTICE_GAME_KEY = "guesssenpai:practice:anidle:game:v1";
export const PRACTICE_TALLY_KEY = "guesssenpai:practice:anidle:tally:v1";
export const PRACTICE_SOURCE_KEY = "guesssenpai:practice:anidle:source:v1";
/** How many recent answers a new puzzle avoids repeating. */
export const RECENT_LIMIT = 10;

/** Where answers come from: the shared popular pool or the player's AniList list. */
export type PracticeSource = "popular" | "list";

export interface PracticeGame {
  practiceId: string;
  source: PracticeSource;
  mediaId: number;
  puzzle: AnidleGame;
  coverImage: string | null;
}

/** The saved current game, so a reload resumes it. */
export interface PracticeSession extends PracticeGame {
  progress?: GameProgress;
  /** True once this game has been added to the tally. */
  tallied: boolean;
  recentMediaIds: number[];
}

export interface PracticeTally {
  played: number;
  solved: number;
  /** Sum of guesses over solved games, for the average. */
  solvedGuesses: number;
}

export const EMPTY_TALLY: PracticeTally = {
  played: 0,
  solved: 0,
  solvedGuesses: 0,
};

interface PracticeApiResponse {
  practice_id: string;
  source?: PracticeSource;
  anidle: {
    mediaId: number;
    puzzle: AnidleGame;
    solution?: { coverImage?: string | null };
  };
}

/** Thrown when list practice needs an AniList sign-in. */
export class PracticeSignInRequired extends Error {}

async function practiceError(response: Response): Promise<Error> {
  if (response.status === 401) {
    return new PracticeSignInRequired(
      "Sign in with AniList to practise from your list.",
    );
  }
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body?.detail === "string" && body.detail) {
      return new Error(body.detail);
    }
  } catch {
    // Fall through to the generic message.
  }
  return new Error(`Couldn't load a practice puzzle (${response.status})`);
}

export async function fetchPracticeGame(
  exclude: number[] = [],
  source: PracticeSource = "popular",
): Promise<PracticeGame> {
  const params = new URLSearchParams();
  exclude.slice(0, RECENT_LIMIT).forEach((id) => {
    params.append("exclude", String(id));
  });
  if (source === "list") params.set("source", "list");
  const query = params.toString();
  const response = await fetch(
    `${API_BASE}/puzzles/anidle/practice${query ? `?${query}` : ""}`,
    // The list source reads the signed-in session cookie.
    { cache: "no-store", credentials: "include" },
  );
  if (!response.ok) {
    throw await practiceError(response);
  }
  const data = (await response.json()) as PracticeApiResponse;
  if (!data?.practice_id || !data.anidle?.puzzle) {
    throw new Error("Invalid practice puzzle response");
  }
  return {
    practiceId: data.practice_id,
    source: data.source === "list" ? "list" : "popular",
    mediaId: data.anidle.mediaId,
    puzzle: data.anidle.puzzle,
    coverImage: data.anidle.solution?.coverImage ?? null,
  };
}

export function recordPracticeResult(
  tally: PracticeTally,
  result: { solved: boolean; guesses: number },
): PracticeTally {
  return {
    played: tally.played + 1,
    solved: tally.solved + (result.solved ? 1 : 0),
    solvedGuesses: tally.solvedGuesses + (result.solved ? result.guesses : 0),
  };
}

/** Mean guesses over solved games, or null before the first solve. */
export function averageGuesses(tally: PracticeTally): number | null {
  return tally.solved > 0 ? tally.solvedGuesses / tally.solved : null;
}

export function formatAverage(tally: PracticeTally): string {
  const average = averageGuesses(tally);
  return average === null ? "—" : average.toFixed(1);
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

export function parseTally(raw: unknown): PracticeTally {
  if (!raw || typeof raw !== "object") return { ...EMPTY_TALLY };
  const record = raw as Record<string, unknown>;
  const played = count(record.played);
  const solved = Math.min(count(record.solved), played);
  return {
    played,
    solved,
    solvedGuesses: solved ? count(record.solvedGuesses) : 0,
  };
}

export function parseSession(raw: unknown): PracticeSession | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const puzzle = record.puzzle as AnidleGame | undefined;
  if (
    typeof record.practiceId !== "string" ||
    typeof record.mediaId !== "number" ||
    !puzzle ||
    typeof puzzle.answer !== "string" ||
    !puzzle.hints
  ) {
    return null;
  }
  return {
    practiceId: record.practiceId,
    source: record.source === "list" ? "list" : "popular",
    mediaId: record.mediaId,
    puzzle,
    coverImage:
      typeof record.coverImage === "string" ? record.coverImage : null,
    progress: (record.progress as GameProgress | undefined) ?? undefined,
    tallied: record.tallied === true,
    recentMediaIds: Array.isArray(record.recentMediaIds)
      ? (record.recentMediaIds as unknown[])
          .filter((id): id is number => typeof id === "number")
          .slice(0, RECENT_LIMIT)
      : [],
  };
}

function readJson(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private mode, quota); practice still works.
  }
}

export const loadPracticeTally = (): PracticeTally =>
  parseTally(readJson(PRACTICE_TALLY_KEY));
export const savePracticeTally = (tally: PracticeTally): void =>
  writeJson(PRACTICE_TALLY_KEY, tally);
export const loadPracticeSource = (): PracticeSource =>
  readJson(PRACTICE_SOURCE_KEY) === "list" ? "list" : "popular";
export const savePracticeSource = (source: PracticeSource): void =>
  writeJson(PRACTICE_SOURCE_KEY, source);
export const loadPracticeSession = (): PracticeSession | null =>
  parseSession(readJson(PRACTICE_GAME_KEY));
export const savePracticeSession = (session: PracticeSession): void =>
  writeJson(PRACTICE_GAME_KEY, session);
