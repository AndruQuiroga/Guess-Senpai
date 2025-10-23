"use client";

import { ReactNode } from "react";

import { GameShell } from "../GameShell";

interface Props {
  title: string;
  description?: ReactNode;
}

export function PlaceholderPuzzlePage({ title, description }: Props) {
  return (
    <GameShell title={title} round={1} totalRounds={1} onJumpRound={() => undefined}>
      <div className="flex flex-col items-center justify-center gap-4 py-10 text-center text-neutral-200">
        <p className="text-lg font-semibold">{title} is coming soon!</p>
        <p className="max-w-md text-sm text-neutral-300">
          {description ?? "We&apos;re still building this game mode. Check back soon for a fresh way to test your anime knowledge."}
        </p>
      </div>
    </GameShell>
  );
}
