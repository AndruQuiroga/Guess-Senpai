import type { DailyProgress, GameKey, GameProgress } from "../types/progress";
import {
  anidleClueCost,
  isAnidleClueId,
  legacyAnidleClues,
} from "../components/anidle/hints";
import { ROUND_POINTS } from "../components/rounds/scoring";
import { getGameOutcome } from "./gameAction";

/**
 * Daily score: presentation only, computed on the client from the progress
 * records already stored for today. It is not verified by the server, so it is
 * not suitable for leaderboards until scoring moves server-side.
 *
 * - Every playable mode is worth up to POINTS_PER_GAME: three rounds of
 *   ROUND_POINTS (1,000) each.
 * - Round games (rounds v3) score the points each played round earned, even
 *   before the last round is played.
 * - Anidle (rules v2): solved on attempt a of L scores
 *   POINTS_PER_GAME * (L - a + 1) / L, minus the price of each bought clue
 *   (genres, year, synopsis); unsolved and exhausted score 0.
 * - Older round records without points: each round scores
 *   max(25%, 100% - 25% * misses) of its share, where a miss is a wrong guess
 *   or an extra hint stage. The mode score is the mean over its rounds.
 */
export const ROUNDS_PER_GAME = 3;
export const POINTS_PER_GAME = ROUND_POINTS * ROUNDS_PER_GAME;
export const DEFAULT_ANIDLE_ATTEMPTS = 8;
export const MISS_PENALTY = 0.25;
export const MIN_SOLVED_EFFICIENCY = 0.25;

function count(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function efficiencyForMisses(misses: number): number {
  const safe = Math.max(0, Math.floor(misses));
  return Math.max(MIN_SOLVED_EFFICIENCY, 1 - MISS_PENALTY * safe);
}

function scoreAnidle(progress: GameProgress): number {
  const limitRaw = finiteNumber(progress.attemptLimit);
  const limit =
    limitRaw !== null && limitRaw >= 1
      ? Math.floor(limitRaw)
      : DEFAULT_ANIDLE_ATTEMPTS;
  // Legacy records have no anidleHistory; their guess list is the best proxy.
  const used = count(progress.anidleHistory) || count(progress.guesses);
  const attempts = Math.min(limit, Math.max(1, used));
  const bought = progress.anidleHints?.length
    ? progress.anidleHints.filter(isAnidleClueId)
    : legacyAnidleClues(Math.max(0, finiteNumber(progress.hintsRevealed) ?? 0));
  const base = (POINTS_PER_GAME * (limit - attempts + 1)) / limit;
  return Math.max(0, Math.round(base - anidleClueCost(bought)));
}

function roundMisses(gameKey: GameKey, round: unknown): number {
  const entry = (round ?? {}) as { guesses?: unknown; stage?: unknown };
  const guesses = count(entry.guesses);
  const stage = finiteNumber(entry.stage);
  if (gameKey === "character_silhouette") {
    // `stage` is the number of solved cards; each solved card takes a guess.
    return Math.max(0, guesses - Math.max(1, stage ?? 0));
  }
  if (stage !== null && stage >= 1) return stage - 1;
  return Math.max(0, guesses - 1);
}

function scoreRounds(gameKey: GameKey, progress: GameProgress): number {
  const rounds = Array.isArray(progress.rounds) ? progress.rounds : [];
  if (rounds.length > 0) {
    const total = rounds.reduce(
      (sum, round) => sum + efficiencyForMisses(roundMisses(gameKey, round)),
      0,
    );
    return Math.round((POINTS_PER_GAME * total) / rounds.length);
  }
  // Single-round or legacy record: Synopsis keeps its reveal round at the top
  // level (1-3); anything else falls back to the guess count.
  const round = finiteNumber(progress.round);
  const misses =
    gameKey === "redacted_synopsis" && round !== null && round >= 1
      ? round - 1
      : Math.max(0, count(progress.guesses) - 1);
  return Math.round(POINTS_PER_GAME * efficiencyForMisses(misses));
}

/** Points (0 to POINTS_PER_GAME) for one mode's stored progress. */
export function scoreGame(
  gameKey: GameKey,
  progress?: GameProgress | null,
): number {
  if (!progress || typeof progress !== "object") return 0;
  if (gameKey !== "anidle") {
    const scored = (progress.rounds ?? []).filter(
      (round) => typeof round?.points === "number",
    );
    if (scored.length > 0) {
      const earned = scored.reduce(
        (sum, round) => sum + (round.points ?? 0),
        0,
      );
      return Math.min(POINTS_PER_GAME, Math.max(0, Math.round(earned)));
    }
  }
  if (getGameOutcome(progress) !== "solved") return 0;
  return gameKey === "anidle"
    ? scoreAnidle(progress)
    : scoreRounds(gameKey, progress);
}

export interface DailyScore {
  total: number;
  max: number;
  perGame: Partial<Record<GameKey, number>>;
}

/**
 * Today's score over the given playable modes. Pass `null` progress while it is
 * still unknown; the max is still reported.
 */
export function computeDailyScore(
  gameKeys: readonly GameKey[],
  progress?: DailyProgress | null,
): DailyScore {
  const unique = Array.from(new Set(gameKeys));
  const perGame: Partial<Record<GameKey, number>> = {};
  let total = 0;
  for (const key of unique) {
    const points = scoreGame(key, progress?.[key]);
    perGame[key] = points;
    total += points;
  }
  return { total, max: unique.length * POINTS_PER_GAME, perGame };
}

const numberFormat = new Intl.NumberFormat("en-US");

export function formatDailyScore(score: DailyScore): string {
  return `${numberFormat.format(score.total)} / ${numberFormat.format(score.max)}`;
}
