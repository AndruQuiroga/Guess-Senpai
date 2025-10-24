"use client";

import { useRef } from "react";

import CharacterSilhouette from "../CharacterSilhouette";
import GameSwitcher from "../GameSwitcher";
import { GameShell } from "../GameShell";
import type { GameProgress } from "../../types/progress";
import type { CharacterSilhouetteGame } from "../../types/puzzles";

interface Props {
  slug: string;
  mediaId: number;
  payload: CharacterSilhouetteGame;
  progress?: GameProgress;
  onProgressChange: (state: GameProgress) => void;
  nextSlug?: string | null;
}

export function CharacterSilhouettePage({
  slug,
  mediaId,
  payload,
  progress,
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
      actions={<GameSwitcher currentSlug={slug} />}
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
