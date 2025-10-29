"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import CharacterSilhouette from "../CharacterSilhouette";
import GameSwitcher from "../GameSwitcher";
import { GameShell } from "../GameShell";
import type { DailyProgress, GameProgress } from "../../types/progress";
import type { CharacterSilhouetteGame } from "../../types/puzzles";

interface Props {
  slug: string;
  mediaId: number;
  payload: CharacterSilhouetteGame;
  progress?: GameProgress;
  dailyProgress?: DailyProgress;
  accountDifficulty?: number;
  difficultyHint?: number;
  onProgressChange: (state: GameProgress) => void;
  nextSlug?: string | null;
}

export function CharacterSilhouettePage({
  slug,
  mediaId,
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

  const totalRounds = useMemo(
    () => Math.max(payload.rounds?.length ?? payload.spec.length ?? 1, 1),
    [payload.rounds?.length, payload.spec.length],
  );

  const clampRound = useCallback(
    (value: number | undefined | null) => {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return 1;
      }
      const normalized = Math.floor(value);
      return Math.max(1, Math.min(totalRounds, normalized));
    },
    [totalRounds],
  );

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

  const [displayRound, setDisplayRound] = useState(() =>
    clampRound(progress?.round ?? highlightDifficulty),
  );

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
    setDisplayRound(clampRound(progress?.round ?? highlightDifficulty));
  }, [clampRound, progress?.round, highlightDifficulty]);

  const handleProgressChange = useCallback(
    (state: GameProgress) => {
      setDisplayRound(clampRound(state.round));
      onProgressChange(state);
    },
    [clampRound, onProgressChange],
  );

  return (
    <div className="space-y-6">
      <GameShell
        title="Character Silhouette"
        round={displayRound}
        totalRounds={totalRounds}
        actions={<GameSwitcher currentSlug={slug} progress={dailyProgress} />}
      >
        <CharacterSilhouette
          mediaId={mediaId}
          payload={payload}
          initialProgress={progress}
          onProgressChange={handleProgressChange}
          registerRoundController={(fn) => {
            controller.current = fn;
            setControllerReady(true);
          }}
          nextSlug={nextSlug}
        />
      </GameShell>
    </div>
  );
}
