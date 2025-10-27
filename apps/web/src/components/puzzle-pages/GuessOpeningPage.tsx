"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import GuessOpening from "../GuessOpening";
import GameSwitcher from "../GameSwitcher";
import { GameShell } from "../GameShell";
import type { DailyProgress, GameProgress } from "../../types/progress";
import { GuessOpeningGame } from "../../types/puzzles";

interface Props {
  slug: string;
  mediaId: number;
  payload: GuessOpeningGame;
  progress?: GameProgress;
  dailyProgress?: DailyProgress;
  accountDifficulty?: number;
  difficultyHint?: number;
  onProgressChange: (state: GameProgress) => void;
  nextSlug?: string | null;
}

export function GuessOpeningPage({
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
      <div className="rounded-3xl border border-white/10 bg-surface-raised p-6 text-neutral-100 shadow-ambient">
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
        round={displayRound}
        totalRounds={totalRounds}
        roundLabel="Opening"
        onJumpRound={(target) => controller.current?.(target)}
        actions={<GameSwitcher currentSlug={slug} progress={dailyProgress} />}
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
