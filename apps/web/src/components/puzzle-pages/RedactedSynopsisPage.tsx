"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import SynopsisRedacted from "../SynopsisRedacted";
import GameSwitcher from "../GameSwitcher";
import { GameShell } from "../GameShell";
import type { DailyProgress, GameProgress } from "../../types/progress";
import { RedactedSynopsisGame } from "../../types/puzzles";
import { GameDifficultyPresets, type DifficultyPreset } from "./GameDifficultyPresets";

interface Props {
  slug: string;
  mediaId: number;
  payload: RedactedSynopsisGame;
  progress?: GameProgress;
  dailyProgress?: DailyProgress;
  accountDifficulty?: number;
  difficultyHint?: number;
  onDifficultyChange?: (level: number) => void;
  onProgressChange: (state: GameProgress) => void;
  nextSlug?: string | null;
}

const SYNOPSIS_PRESETS: DifficultyPreset[] = [
  {
    value: 1,
    label: "Light blackout",
    description: "Reveal the synopsis with minimal redactions for a gentle intro.",
  },
  {
    value: 2,
    label: "Partial reveal",
    description: "Unmask a few more keywords while keeping the mystery intact.",
  },
  {
    value: 3,
    label: "Hard mode",
    description: "Start with heavy censorship and decipher the story from scraps.",
  },
];

export function RedactedSynopsisPage({
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

  const handlePresetSelect = useCallback(
    (level: number) => {
      const clamped = clampDifficulty(level) ?? 1;
      onDifficultyChange?.(clamped);
      controller.current?.(clamped);
    },
    [clampDifficulty, onDifficultyChange],
  );

  return (
    <div className="space-y-6">
      <GameDifficultyPresets
        title="Tune the censorship"
        description="Decide how many blanks to fill before you craft your first theory."
        presets={SYNOPSIS_PRESETS}
        selected={selectedDifficulty}
        recommended={recommendedDifficulty}
        onSelect={handlePresetSelect}
      />
      <GameShell
        title="Redacted Synopsis"
        round={progress?.round ?? highlightDifficulty}
        totalRounds={totalRounds}
        onJumpRound={(target) => controller.current?.(target)}
        actions={<GameSwitcher currentSlug={slug} progress={dailyProgress} />}
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
