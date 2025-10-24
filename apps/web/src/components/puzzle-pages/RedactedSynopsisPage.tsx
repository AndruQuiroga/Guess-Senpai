"use client";

import { useRef } from "react";

import SynopsisRedacted from "../SynopsisRedacted";
import GameSwitcher from "../GameSwitcher";
import { GameShell } from "../GameShell";
import type { DailyProgress, GameProgress } from "../../types/progress";
import { RedactedSynopsisGame } from "../../types/puzzles";

interface Props {
  slug: string;
  mediaId: number;
  payload: RedactedSynopsisGame;
  progress?: GameProgress;
  dailyProgress?: DailyProgress;
  onProgressChange: (state: GameProgress) => void;
  nextSlug?: string | null;
}

export function RedactedSynopsisPage({
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
      title="Redacted Synopsis"
      round={progress?.round ?? 1}
      totalRounds={3}
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
        }}
        nextSlug={nextSlug}
      />
    </GameShell>
  );
}
