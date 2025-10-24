"use client";

import { useRef } from "react";

import SynopsisRedacted from "../SynopsisRedacted";
import GameSwitcher from "../GameSwitcher";
import { GameShell } from "../GameShell";
import { GameProgress } from "../../types/progress";
import { RedactedSynopsisGame } from "../../types/puzzles";

interface Props {
  slug: string;
  payload: RedactedSynopsisGame;
  progress?: GameProgress;
  onProgressChange: (state: GameProgress) => void;
  nextSlug?: string | null;
}

export function RedactedSynopsisPage({
  slug,
  payload,
  progress,
  onProgressChange,
  nextSlug,
}: Props) {
  const controller = useRef<((round: number) => void) | null>(null);

  return (
    <GameShell
      title="Redacted Synopsis"
      round={progress?.round ?? 1}
      totalRounds={3}
      onJumpRound={(target) => controller.current?.(target)}
      actions={<GameSwitcher currentSlug={slug} />}
    >
      <SynopsisRedacted
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
