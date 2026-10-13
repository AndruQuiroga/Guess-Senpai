import type { GameProgress } from "../types/progress";
import type { AnidleGame } from "../types/puzzles";

/*
 * Unlimited Anidle is practice: nothing here touches daily progress, the
 * streak, the daily score or the account. It has its own localStorage keys.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export const PRACTICE_GAME_KEY = "guesssenpai:practice:anidle:game:v1";
export const PRACTICE_TALLY_KEY = "guesssenpai:practice:anidle:tally:v1";
/** How many recent answers a new puzzle avoids repeating. */
export const RECENT_LIMIT = 10;

export interface PracticeGame {
  practiceId: string;
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
  anidle: {
    mediaId: number;
    puzzle: AnidleGame;
    solution?: { coverImage?: string | null };
  };
}

export async function fetchPracticeGame(
  exclude: number[] = [],
): Promise<PracticeGame> {
  const params = new URLSearchParams();
  exclude.slice(0, RECENT_LIMIT).forEach((id) => {
    params.append("exclude", String(id));
  });
  const query = params.toString();
  const response = await fetch(
    `${API_BASE}/puzzles/anidle/practice${query ? `?${query}` : ""}`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(`Couldn't load a practice puzzle (${response.status})`);
  }
  const data = (await response.json()) as PracticeApiResponse;
  if (!data?.practice_id || !data.anidle?.puzzle) {
    throw new Error("Invalid practice puzzle response");
  }
  return {
    practiceId: data.practice_id,
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
export const loadPracticeSession = (): PracticeSession | null =>
  parseSession(readJson(PRACTICE_GAME_KEY));
export const savePracticeSession = (session: PracticeSession): void =>
  writeJson(PRACTICE_GAME_KEY, session);
