"use client";

import { useRef } from "react";

import GuessOpening from "../GuessOpening";
import GameSwitcher from "../GameSwitcher";
import { GameShell } from "../GameShell";
import type { DailyProgress, GameProgress } from "../../types/progress";
import { GuessOpeningGame } from "../../types/puzzles";

interface Props {
  slug: string;
  mediaId: number;
  payload: GuessOpeningGame;
  progress?: GameProgress;
  dailyProgress?: DailyProgress;
  onProgressChange: (state: GameProgress) => void;
  nextSlug?: string | null;
}

export function GuessOpeningPage({
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
      title="Guess the Opening"
      round={progress?.round ?? 1}
      totalRounds={3}
      onJumpRound={(target) => controller.current?.(target)}
      actions={<GameSwitcher currentSlug={slug} progress={dailyProgress} />}
    >
      <GuessOpening
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
