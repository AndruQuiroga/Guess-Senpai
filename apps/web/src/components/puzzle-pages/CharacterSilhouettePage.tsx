"use client";

import { useRef } from "react";

import CharacterSilhouette from "../CharacterSilhouette";
import GameSwitcher from "../GameSwitcher";
import { GameShell } from "../GameShell";
import type { DailyProgress, GameProgress } from "../../types/progress";
import type { CharacterSilhouetteGame } from "../../types/puzzles";

interface Props {
  slug: string;
  mediaId: number;
  payload: CharacterSilhouetteGame;
  progress?: GameProgress;
  dailyProgress?: DailyProgress;
  onProgressChange: (state: GameProgress) => void;
  nextSlug?: string | null;
}

export function CharacterSilhouettePage({
  slug,
  mediaId,
  payload,
  progress,
  dailyProgress,
  onProgressChange,
  nextSlug,
}: Props) {
  const controller = useRef<((round: number) => void) | null>(null);
  const totalRounds = Math.max(payload.spec.length, 1);

  return (
    <GameShell
      title="Character Silhouette"
      round={progress?.round ?? 1}
      totalRounds={totalRounds}
      onJumpRound={(target) => controller.current?.(target)}
      actions={<GameSwitcher currentSlug={slug} progress={dailyProgress} />}
    >
      <CharacterSilhouette
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
