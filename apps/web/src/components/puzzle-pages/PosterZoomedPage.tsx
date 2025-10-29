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
  difficultyHint,
  onProgressChange,
  nextSlug,
}: Props) {
  const controller = useRef<((round: number) => void) | null>(null);
  const [controllerReady, setControllerReady] = useState(false);

  const primaryRound = useMemo(() => payload.rounds[0] ?? null, [payload.rounds]);
  const mediaId = primaryRound?.mediaId ?? null;

  const totalRounds = useMemo(() => {
    if (payload.spec.length > 0) {
      return payload.spec.length;
    }
    if (primaryRound?.cropStages && primaryRound.cropStages.length > 0) {
      return primaryRound.cropStages.length;
    }
    return 3;
  }, [payload.spec.length, primaryRound]);

  const clampDifficulty = useCallback(
    (value: number | undefined | null) => {
      if (typeof value !== "number" || Number.isNaN(value)) {
        return undefined;
      }
      const rounded = Math.round(value);
      return Math.max(1, Math.min(totalRounds, rounded));
    },
    [totalRounds],
  );

  const selectedDifficulty = clampDifficulty(accountDifficulty);
  const recommendedDifficulty = clampDifficulty(difficultyHint);
  const highlightDifficulty = selectedDifficulty ?? recommendedDifficulty ?? 1;
  const [displayRound, setDisplayRound] = useState(progress?.round ?? highlightDifficulty);

  useEffect(() => {
    controller.current = null;
    setControllerReady(false);
  }, [mediaId]);

  useEffect(() => {
    if (!controllerReady) return;
    if (progress?.completed) return;
    controller.current?.(highlightDifficulty);
  }, [controllerReady, highlightDifficulty, progress?.completed]);

  useEffect(() => {
    setDisplayRound(progress?.round ?? highlightDifficulty);
  }, [progress?.round, highlightDifficulty]);

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
          accountDifficulty={selectedDifficulty}
        />
      </GameShell>
    </div>
  );
}
