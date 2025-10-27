"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import CharacterSilhouette from "../CharacterSilhouette";
import GameSwitcher from "../GameSwitcher";
import { GameShell } from "../GameShell";
import type { DailyProgress, GameProgress } from "../../types/progress";
import type { CharacterSilhouetteGame } from "../../types/puzzles";
import { GameDifficultyPresets, type DifficultyPreset } from "./GameDifficultyPresets";

interface Props {
  slug: string;
  mediaId: number;
  payload: CharacterSilhouetteGame;
  progress?: GameProgress;
  dailyProgress?: DailyProgress;
  difficultyChoice?: number;
  difficultyHint?: number;
  onDifficultyChange?: (level: number) => void;
  onProgressChange: (state: GameProgress) => void;
  nextSlug?: string | null;
}

const SILHOUETTE_PRESETS: DifficultyPreset[] = [
  {
    value: 1,
    label: "Shadow outline",
    description: "Begin with the dramatic silhouette and clear shape cues.",
  },
  {
    value: 2,
    label: "Stage lights",
    description: "Fade in more lighting to sharpen the character details.",
  },
  {
    value: 3,
    label: "Full reveal",
    description: "Crank the lights to maximum and guess from the final portrait.",
  },
];

export function CharacterSilhouettePage({
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
        title="Adjust the reveal"
        description="Decide how much lighting to start with before the silhouette steps into frame."
        presets={SILHOUETTE_PRESETS}
        selected={selectedDifficulty}
        recommended={recommendedDifficulty}
        onSelect={handlePresetSelect}
      />
      <GameShell
        title="Character Silhouette"
        round={displayRound}
        totalRounds={totalRounds}
        onJumpRound={(target) => controller.current?.(target)}
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
