"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import PosterZoom from "../PosterZoom";
import GameSwitcher from "../GameSwitcher";
import { GameShell } from "../GameShell";
import type { DailyProgress, GameProgress } from "../../types/progress";
import { PosterZoomGame } from "../../types/puzzles";

interface Props {
  slug: string;
  payload: PosterZoomGame;
  progress?: GameProgress;
  dailyProgress?: DailyProgress;
  accountDifficulty?: number;
  difficultyHint?: number;
  onProgressChange: (state: GameProgress) => void;
  nextSlug?: string | null;
}

export function PosterZoomedPage({
  slug,
  payload,
  progress,
  dailyProgress,
  accountDifficulty,
  onProgressChange,
  nextSlug,
}: Props) {
  const controller = useRef<((round: number) => void) | null>(null);
  const [controllerReady, setControllerReady] = useState(false);

  const totalRounds = useMemo(
    () => (payload.rounds.length > 0 ? payload.rounds.length : 1),
    [payload.rounds.length],
  );

  const clampRound = useCallback(
    (value: number | undefined | null) => {
      if (typeof value !== "number" || Number.isNaN(value)) {
        return undefined;
      }
      const rounded = Math.round(value);
      return Math.max(1, Math.min(totalRounds, rounded));
    },
    [totalRounds],
  );

  const highlightedRound = clampRound(progress?.round) ?? 1;
  const [displayRound, setDisplayRound] = useState(highlightedRound);

  useEffect(() => {
    controller.current = null;
    setControllerReady(false);
  }, [payload.rounds]);

  useEffect(() => {
    if (!controllerReady) return;
    if (progress?.completed) return;
    controller.current?.(highlightedRound);
  }, [controllerReady, highlightedRound, progress?.completed]);

  useEffect(() => {
    setDisplayRound(highlightedRound);
  }, [highlightedRound]);

  const handleProgressChange = useCallback(
    (state: GameProgress) => {
      setDisplayRound(state.round);
      onProgressChange(state);
    },
    [onProgressChange],
  );

  return (
    <div className="space-y-6">
      <GameShell
        title="Poster Zoomed"
        round={displayRound}
        totalRounds={totalRounds}
        actions={<GameSwitcher currentSlug={slug} progress={dailyProgress} />}
      >
        <PosterZoom
          payload={payload}
          initialProgress={progress}
          onProgressChange={handleProgressChange}
          registerRoundController={(fn) => {
            controller.current = fn;
            setControllerReady(true);
          }}
          nextSlug={nextSlug}
          accountDifficulty={accountDifficulty}
        />
      </GameShell>
    </div>
  );
}
