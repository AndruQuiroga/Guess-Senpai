"use client";

import { useRef } from "react";

import SynopsisRedacted from "../SynopsisRedacted";
import { GameShell } from "../GameShell";
import { GameProgress } from "../../types/progress";
import { RedactedSynopsisGame } from "../../types/puzzles";

interface Props {
  payload: RedactedSynopsisGame;
  progress?: GameProgress;
  onProgressChange: (state: GameProgress) => void;
}

export function RedactedSynopsisPage({ payload, progress, onProgressChange }: Props) {
  const controller = useRef<((round: number) => void) | null>(null);

  return (
    <GameShell
      title="Redacted Synopsis"
      round={progress?.round ?? 1}
      totalRounds={3}
      onJumpRound={(target) => controller.current?.(target)}
    >
      <SynopsisRedacted
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
