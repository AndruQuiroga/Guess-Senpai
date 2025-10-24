"use client";

import { useRef } from "react";

import PosterZoom from "../PosterZoom";
import GameSwitcher from "../GameSwitcher";
import { GameShell } from "../GameShell";
import type { DailyProgress, GameProgress } from "../../types/progress";
import { PosterZoomGame } from "../../types/puzzles";

interface Props {
  slug: string;
  mediaId: number;
  payload: PosterZoomGame;
  progress?: GameProgress;
  dailyProgress?: DailyProgress;
  onProgressChange: (state: GameProgress) => void;
  nextSlug?: string | null;
}

export function PosterZoomedPage({
  slug,
  mediaId,
  payload,
  progress,
  dailyProgress,
  onProgressChange,
  nextSlug,
}: Props) {
  const controller = useRef<((round: number) => void) | null>(null);

  return (
    <GameShell
      title="Poster Zoomed"
      round={progress?.round ?? 1}
      totalRounds={payload.spec.length || payload.cropStages?.length || 3}
      onJumpRound={(target) => controller.current?.(target)}
      actions={<GameSwitcher currentSlug={slug} progress={dailyProgress} />}
    >
      <PosterZoom
        mediaId={mediaId}
        payload={payload}
        initialProgress={progress}
        onProgressChange={onProgressChange}
        registerRoundController={(fn) => {
          controller.current = fn;
        }}
        nextSlug={nextSlug}
      />
    </GameShell>
  );
}
