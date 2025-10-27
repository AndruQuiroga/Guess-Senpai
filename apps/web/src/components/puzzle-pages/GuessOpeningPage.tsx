"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import GuessOpening from "../GuessOpening";
import GameSwitcher from "../GameSwitcher";
import { GameShell } from "../GameShell";
import type { DailyProgress, GameProgress } from "../../types/progress";
import { GuessOpeningGame } from "../../types/puzzles";
import { GameDifficultyPresets, type DifficultyPreset } from "./GameDifficultyPresets";

interface Props {
  slug: string;
  mediaId: number;
  payload: GuessOpeningGame;
  progress?: GameProgress;
  dailyProgress?: DailyProgress;
  difficultyChoice?: number;
  difficultyHint?: number;
  onDifficultyChange?: (level: number) => void;
  onProgressChange: (state: GameProgress) => void;
  nextSlug?: string | null;
}

const OPENING_PRESETS: DifficultyPreset[] = [
  {
    value: 1,
    label: "Tempo check",
    description: "Start with generous clip length and seasonal hints to warm up.",
  },
  {
    value: 2,
    label: "Hook spotlight",
    description: "Jump ahead to focus on artist clues with tighter timing.",
  },
  {
    value: 3,
    label: "Blind intro",
    description: "Skip straight to the toughest cut and guess before the chorus hits.",
  },
];

export function GuessOpeningPage({
  slug,
  mediaId,
  payload,
  progress,
  dailyProgress,
  difficultyChoice,
  difficultyHint,
  onDifficultyChange,
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

  const selectedDifficulty = clampDifficulty(difficultyChoice);
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

  const handlePresetSelect = useCallback(
    (level: number) => {
      const clamped = clampDifficulty(level) ?? 1;
      onDifficultyChange?.(clamped);
      controller.current?.(clamped);
    },
    [clampDifficulty, onDifficultyChange],
  );

  const handleProgressChange = useCallback(
    (state: GameProgress) => {
      setDisplayRound(state.round);
      onProgressChange(state);
    },
    [onProgressChange],
  );

  return (
    <div className="space-y-6">
      <GameDifficultyPresets
        title="Choose your listening challenge"
        description="Control how much of the OP you hear before locking in your answer."
        presets={OPENING_PRESETS}
        selected={selectedDifficulty}
        recommended={recommendedDifficulty}
        onSelect={handlePresetSelect}
      />
      <GameShell
        title="Guess the Opening"
        round={displayRound}
        totalRounds={totalRounds}
        onJumpRound={(target) => controller.current?.(target)}
        actions={<GameSwitcher currentSlug={slug} progress={dailyProgress} />}
      >
        <GuessOpening
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
