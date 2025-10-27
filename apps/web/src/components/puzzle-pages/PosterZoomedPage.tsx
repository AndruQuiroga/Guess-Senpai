"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import PosterZoom from "../PosterZoom";
import GameSwitcher from "../GameSwitcher";
import { GameShell } from "../GameShell";
import type { DailyProgress, GameProgress } from "../../types/progress";
import { PosterZoomGame } from "../../types/puzzles";
import { GameDifficultyPresets, type DifficultyPreset } from "./GameDifficultyPresets";

interface Props {
  slug: string;
  mediaId: number;
  payload: PosterZoomGame;
  progress?: GameProgress;
  dailyProgress?: DailyProgress;
  difficultyChoice?: number;
  difficultyHint?: number;
  onDifficultyChange?: (level: number) => void;
  onProgressChange: (state: GameProgress) => void;
  nextSlug?: string | null;
}

const POSTER_PRESETS: DifficultyPreset[] = [
  {
    value: 1,
    label: "Wide reveal",
    description: "Start with the generous first crop and plenty of context clues.",
  },
  {
    value: 2,
    label: "Spotlight focus",
    description: "Jump to the mid zoom for a sharper challenge without going blind.",
  },
  {
    value: 3,
    label: "Full mystery",
    description: "Go straight to the tightest crop and trust your poster instincts.",
  },
];

export function PosterZoomedPage({
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

  const totalRounds = useMemo(() => {
    if (payload.spec.length > 0) {
      return payload.spec.length;
    }
    if (payload.cropStages && payload.cropStages.length > 0) {
      return payload.cropStages.length;
    }
    return 3;
  }, [payload.cropStages, payload.spec.length]);

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
        title="Set your zoom difficulty"
        description="Pick how tight the crop should be before you take your first swing."
        presets={POSTER_PRESETS}
        selected={selectedDifficulty}
        recommended={recommendedDifficulty}
        onSelect={handlePresetSelect}
      />
      <GameShell
        title="Poster Zoomed"
        round={displayRound}
        totalRounds={totalRounds}
        onJumpRound={(target) => controller.current?.(target)}
        actions={<GameSwitcher currentSlug={slug} progress={dailyProgress} />}
      >
        <PosterZoom
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
