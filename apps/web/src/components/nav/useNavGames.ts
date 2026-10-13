"use client";

import { useMemo } from "react";

import {
  useDailyAvailability,
  useRuntimeGamesDirectory,
} from "../../hooks/useDailyAvailability";
import { useStoredDailyProgress } from "../../hooks/usePuzzleProgress";
import { getGameStatus, type GameStatus } from "../../utils/gameAction";

export interface NavGame {
  slug: string;
  title: string;
  href: string;
  /** null while today's progress is still unknown (never claim "New" early). */
  status: GameStatus | null;
}

/**
 * Playable daily modes plus today's status for each. Playability comes only
 * from the runtime directory (availability is the single source of truth);
 * status comes from the progress the game pages persist.
 */
export function useNavGames(): NavGame[] {
  const games = useRuntimeGamesDirectory();
  const { daily } = useDailyAvailability();
  const progress = useStoredDailyProgress(daily);

  return useMemo(
    () =>
      games.map((game) => ({
        slug: game.slug,
        title: game.title,
        href: `/games/${game.slug}`,
        status:
          progress && game.gameKey
            ? getGameStatus(progress[game.gameKey])
            : null,
      })),
    [games, progress],
  );
}
