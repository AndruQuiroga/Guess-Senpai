"use client";

import { useRef } from "react";

import PosterZoom from "../PosterZoom";
import { GameShell } from "../GameShell";
import { GameProgress } from "../../types/progress";
import { PosterZoomGame } from "../../types/puzzles";

interface Props {
  payload: PosterZoomGame;
  progress?: GameProgress;
  onProgressChange: (state: GameProgress) => void;
}

export function PosterZoomedPage({ payload, progress, onProgressChange }: Props) {
  const controller = useRef<((round: number) => void) | null>(null);

  return (
    <GameShell
      title="Poster Zoomed"
      round={progress?.round ?? 1}
      totalRounds={3}
      onJumpRound={(target) => controller.current?.(target)}
    >
      <PosterZoom
        payload={payload}
        initialProgress={progress}
        onProgressChange={onProgressChange}
        registerRoundController={(fn) => {
          controller.current = fn;
        }}
      />
    </GameShell>
  );
}
