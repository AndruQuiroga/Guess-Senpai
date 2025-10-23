"use client";

import { useRef } from "react";

import GuessOpening from "../GuessOpening";
import { GameShell } from "../GameShell";
import { GameProgress } from "../../types/progress";
import { GuessOpeningGame } from "../../types/puzzles";

interface Props {
  payload: GuessOpeningGame;
  progress?: GameProgress;
  onProgressChange: (state: GameProgress) => void;
}

export function GuessOpeningPage({ payload, progress, onProgressChange }: Props) {
  const controller = useRef<((round: number) => void) | null>(null);

  return (
    <GameShell
      title="Guess the Opening"
      round={progress?.round ?? 1}
      totalRounds={3}
      onJumpRound={(target) => controller.current?.(target)}
    >
      <GuessOpening
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
