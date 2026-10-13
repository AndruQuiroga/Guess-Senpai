export type ProgressForAction = {
  completed?: boolean;
  guesses?: string[];
  rounds?: Array<{ guesses?: string[] }>;
  /** Accepted Anidle guesses; length is the accepted-attempt count. */
  anidleHistory?: unknown[];
  /** Attempt budget recorded by rules-v2 Anidle. Absent for legacy play. */
  attemptLimit?: number;
};

export type GameOutcome = "solved" | "exhausted" | null;

/**
 * Single source of truth for "ran out of guesses" outside the game itself.
 * Exhaustion keeps `completed === false` (it is never a solve) but means the
 * answer is revealed and entry is closed. Anidle.tsx derives the same state
 * from its live rules payload; the budget is persisted as `attemptLimit`.
 */
export function isProgressExhausted(
  progress?: ProgressForAction | null,
): boolean {
  if (!progress || progress.completed) return false;
  const limit = progress.attemptLimit;
  if (typeof limit !== "number" || !Number.isFinite(limit) || limit < 1) {
    return false;
  }
  const accepted = progress.anidleHistory?.length ?? 0;
  return accepted >= limit;
}

/** Finished means solved or out of guesses (answer revealed, entry closed). */
export function getGameOutcome(
  progress?: ProgressForAction | null,
): GameOutcome {
  if (progress?.completed) return "solved";
  return isProgressExhausted(progress) ? "exhausted" : null;
}

export function getGameAction(
  progress?: ProgressForAction | null,
): "play" | "resume" | "results" {
  if (getGameOutcome(progress)) return "results";
  const hasGuesses =
    (progress?.guesses?.length ?? 0) > 0 ||
    (progress?.rounds ?? []).some((round) => (round.guesses?.length ?? 0) > 0);
  return hasGuesses ? "resume" : "play";
}

/** Short status text for lists: "Solved", "Out of guesses", etc. */
export function getGameStatusLabel(
  progress?: ProgressForAction | null,
): "Solved" | "Out of guesses" | "In progress" | "Available" {
  const outcome = getGameOutcome(progress);
  if (outcome === "solved") return "Solved";
  if (outcome === "exhausted") return "Out of guesses";
  return getGameAction(progress) === "resume" ? "In progress" : "Available";
}

export type GameStatus = "new" | "in-progress" | "solved" | "out-of-guesses";

/** Navigation/tile status for today's progress in one mode. */
export function getGameStatus(progress?: ProgressForAction | null): GameStatus {
  const outcome = getGameOutcome(progress);
  if (outcome === "solved") return "solved";
  if (outcome === "exhausted") return "out-of-guesses";
  return getGameAction(progress) === "resume" ? "in-progress" : "new";
}

export const GAME_STATUS_TEXT: Record<GameStatus, string> = {
  new: "New",
  "in-progress": "In progress",
  solved: "Solved",
  "out-of-guesses": "Out of guesses",
};
