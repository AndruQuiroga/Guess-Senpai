"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Anidle from "../Anidle";
import GameSwitcher from "../GameSwitcher";
import { GameShell } from "../GameShell";
import type { DailyProgress, GameProgress } from "../../types/progress";
import { AnidleGame } from "../../types/puzzles";
import { GameDifficultyPresets, type DifficultyPreset } from "./GameDifficultyPresets";

interface Props {
  slug: string;
  mediaId: number;
  payload: AnidleGame;
  progress?: GameProgress;
  dailyProgress?: DailyProgress;
  accountDifficulty?: number;
  difficultyHint?: number;
  onDifficultyChange?: (level: number) => void;
  onProgressChange: (state: GameProgress) => void;
  nextSlug?: string | null;
}

const ANIDLE_PRESETS: DifficultyPreset[] = [
  {
    value: 1,
    label: "Warm-up mix",
    description: "Kick off with the opening round and generous mashup hints.",
  },
  {
    value: 2,
    label: "Main stage",
    description: "Skip ahead to richer layers while keeping a safety net of clues.",
  },
  {
    value: 3,
    label: "Encore challenge",
    description: "Jump straight to the final remix for a blindfolded guess.",
  },
];

export function AnidlePage({
  slug,
  mediaId,
  payload,
  progress,
  dailyProgress,
  accountDifficulty,
  difficultyHint,
  onDifficultyChange,
  onProgressChange,
  nextSlug,
}: Props) {
  const controller = useRef<((round: number) => void) | null>(null);
  const [controllerReady, setControllerReady] = useState(false);

  const totalRounds = useMemo(() => Math.max(payload.spec.length, 1), [payload.spec.length]);

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
        title="Pick your playlist difficulty"
        description="Choose how many remix layers you want unlocked before committing to a guess."
        presets={ANIDLE_PRESETS}
        selected={selectedDifficulty}
        recommended={recommendedDifficulty}
        onSelect={handlePresetSelect}
      />
      <GameShell
        title="Anidle"
        round={displayRound}
        totalRounds={totalRounds}
        onJumpRound={(target) => controller.current?.(target)}
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
        />
      </GameShell>
    </div>
  );
}
