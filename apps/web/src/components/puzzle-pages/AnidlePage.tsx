"use client";

import { useRef } from "react";

import Anidle from "../Anidle";
import GameSwitcher from "../GameSwitcher";
import { GameShell } from "../GameShell";
import { GameProgress } from "../../types/progress";
import { AnidleGame } from "../../types/puzzles";

interface Props {
  slug: string;
  mediaId: number;
  payload: AnidleGame;
  progress?: GameProgress;
  onProgressChange: (state: GameProgress) => void;
  nextSlug?: string | null;
}

export function AnidlePage({
  slug,
  mediaId,
  payload,
  progress,
  onProgressChange,
  nextSlug,
}: Props) {
  const controller = useRef<((round: number) => void) | null>(null);

  return (
    <GameShell
      title="Anidle"
      round={progress?.round ?? 1}
      totalRounds={3}
      onJumpRound={(target) => controller.current?.(target)}
      actions={<GameSwitcher currentSlug={slug} />}
    >
      <Anidle
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
