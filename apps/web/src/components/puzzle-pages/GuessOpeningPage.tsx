"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import GuessOpening from "../GuessOpening";
import { GameShell } from "../GameShell";
import type { GameProgress } from "../../types/progress";
import { GuessOpeningGame } from "../../types/puzzles";

interface Props {
  mediaId: number;
  payload: GuessOpeningGame;
  progress?: GameProgress;
  accountDifficulty?: number;
  difficultyHint?: number;
  onProgressChange: (state: GameProgress) => void;
  nextSlug?: string | null;
}

export function GuessOpeningPage({
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
  const rounds = payload.rounds ?? [];
  const totalRounds = Math.max(rounds.length, 1);
  const roundKey = useMemo(
    () => rounds.map((round) => round.mediaId).join("|"),
    [rounds],
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
  const preferredRound = useMemo(
    () =>
      clampDifficulty(progress?.round) ??
      selectedDifficulty ??
      recommendedDifficulty ??
      1,
    [
      clampDifficulty,
      progress?.round,
      recommendedDifficulty,
      selectedDifficulty,
    ],
  );
  const [displayRound, setDisplayRound] = useState(preferredRound);

  useEffect(() => {
    controller.current = null;
    setControllerReady(false);
  }, [mediaId, roundKey]);

  useEffect(() => {
    if (!controllerReady) return;
    controller.current?.(preferredRound);
  }, [controllerReady, preferredRound]);

  useEffect(() => {
    setDisplayRound(preferredRound);
  }, [preferredRound]);

  if (rounds.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-surface-raised p-6 text-paper">
        Unable to load Guess the Opening for today. Please try again later.
      </div>
    );
  }

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
        title="Guess the Opening"
        status={
          <>
            Opening {displayRound} / {totalRounds}
          </>
        }
      >
        <GuessOpening
          payload={rounds}
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
