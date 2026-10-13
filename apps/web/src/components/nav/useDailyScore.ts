"use client";

import { useMemo } from "react";

import {
  useDailyAvailability,
  useRuntimeGamesDirectory,
} from "../../hooks/useDailyAvailability";
import { useStoredDailyProgress } from "../../hooks/usePuzzleProgress";
import type { GameKey } from "../../types/progress";
import { computeDailyScore, type DailyScore } from "../../utils/dailyScore";

/**
 * Today's client-side score over the playable modes. Returns null until
 * today's progress is known. It follows `guesssenpai:progress-changed`
 * through `useStoredDailyProgress`, so it updates as games are played.
 */
export function useDailyScore(): DailyScore | null {
  const games = useRuntimeGamesDirectory();
  const { daily } = useDailyAvailability();
  const progress = useStoredDailyProgress(daily);

  return useMemo(() => {
    if (!progress) return null;
    const keys = games
      .map((game) => game.gameKey)
      .filter((key): key is GameKey => Boolean(key));
    return computeDailyScore(keys, progress);
  }, [games, progress]);
}
