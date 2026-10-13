"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import SynopsisRedacted from "../SynopsisRedacted";
import { GameShell } from "../GameShell";
import type { GameProgress } from "../../types/progress";
import { RedactedSynopsisGame } from "../../types/puzzles";

interface Props {
  mediaId: number;
  payload: RedactedSynopsisGame;
  progress?: GameProgress;
  accountDifficulty?: number;
  difficultyHint?: number;
  onProgressChange: (state: GameProgress) => void;
  nextSlug?: string | null;
}

export function RedactedSynopsisPage({
  mediaId,
  payload,
  progress,
  accountDifficulty,
  difficultyHint,
  onProgressChange,
  nextSlug,
}: Props) {
  const controller = useRef<((round: number) => void) | null>(null);
  const [controllerReady, setControllerReady] = useState(false);
  const totalRounds = 3;

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

  useEffect(() => {
    controller.current = null;
    setControllerReady(false);
  }, [mediaId]);

  useEffect(() => {
    if (!controllerReady) return;
    if (progress?.completed) return;
    controller.current?.(highlightDifficulty);
  }, [controllerReady, highlightDifficulty, progress?.completed]);

  return (
    <div className="space-y-6">
      <GameShell
        title="Redacted Synopsis"
        status={
          <>
            {progress?.completed
              ? "Revealed"
              : `Hint ${Math.min(totalRounds, progress?.round ?? highlightDifficulty)} / ${totalRounds}`}
          </>
        }
      >
        <SynopsisRedacted
          mediaId={mediaId}
          payload={payload}
          initialProgress={progress}
          onProgressChange={onProgressChange}
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
