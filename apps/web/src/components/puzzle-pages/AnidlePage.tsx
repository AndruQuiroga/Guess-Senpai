"use client";

import { useRef } from "react";

import Anidle from "../Anidle";
import { GameShell } from "../GameShell";
import { GameProgress } from "../../types/progress";
import { AnidleGame } from "../../types/puzzles";

interface Props {
  payload: AnidleGame;
  progress?: GameProgress;
  onProgressChange: (state: GameProgress) => void;
}

export function AnidlePage({ payload, progress, onProgressChange }: Props) {
  const controller = useRef<((round: number) => void) | null>(null);

  return (
    <GameShell
      title="Anidle"
      round={progress?.round ?? 1}
      totalRounds={3}
      onJumpRound={(target) => controller.current?.(target)}
    >
      <Anidle
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
