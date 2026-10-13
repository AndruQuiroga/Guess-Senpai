"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Anidle from "../Anidle";
import GameSwitcher from "../GameSwitcher";
import { GameShell } from "../GameShell";
import type { DailyProgress, GameProgress } from "../../types/progress";
import { AnidleGame } from "../../types/puzzles";
import { isProgressExhausted } from "../../utils/gameAction";

interface Props {
  slug: string;
  mediaId: number;
  payload: AnidleGame;
  progress?: GameProgress;
  dailyProgress?: DailyProgress;
  accountDifficulty?: number;
  difficultyHint?: number;
  onProgressChange: (state: GameProgress) => void;
  nextSlug?: string | null;
}

export function AnidlePage({
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

  const rules = payload.rules?.version === "2" ? payload.rules : null;
  const totalRounds = useMemo(
    () => (rules ? rules.max_attempts : Math.max(payload.spec.length, 1)),
    [payload.spec.length, rules],
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
  // Rules v2 is one anime with a guess budget, so the header counts guesses.
  // Legacy rules keep the three-round header.
  const headerPosition = useCallback(
    (state?: GameProgress | null) => {
      if (!rules) return state?.round ?? highlightDifficulty;
      const accepted = state?.anidleHistory?.length ?? 0;
      const finished =
        Boolean(state?.completed) ||
        isProgressExhausted({
          completed: state?.completed,
          anidleHistory: state?.anidleHistory,
          attemptLimit: rules.max_attempts,
        });
      return Math.min(finished ? accepted : accepted + 1, rules.max_attempts);
    },
    [highlightDifficulty, rules],
  );
  const [displayRound, setDisplayRound] = useState(() =>
    headerPosition(progress),
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
    setDisplayRound(headerPosition(progress));
  }, [progress, headerPosition]);

  const handleProgressChange = useCallback(
    (state: GameProgress) => {
      setDisplayRound(headerPosition(state));
      onProgressChange(state);
    },
    [headerPosition, onProgressChange],
  );

  return (
    <div className="space-y-6">
      <GameShell
        title="Anidle"
        round={displayRound}
        totalRounds={totalRounds}
        roundLabel={rules ? "Guess" : "Round"}
        actions={<GameSwitcher currentSlug={slug} progress={dailyProgress} />}
      >
        <Anidle
          mediaId={mediaId}
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
