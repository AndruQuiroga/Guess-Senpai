"use client";

import { ReactNode } from "react";

import GameSwitcher from "../GameSwitcher";
import { GameShell } from "../GameShell";

interface Props {
  title: string;
  slug?: string;
  description?: ReactNode;
}

export function PlaceholderPuzzlePage({ title, slug, description }: Props) {
  return (
    <GameShell
      title={title}
      round={1}
      totalRounds={1}
      onJumpRound={() => undefined}
      actions={<GameSwitcher currentSlug={slug} />}
    >
      <div className="flex flex-col items-center justify-center gap-4 py-10 text-center text-neutral-200">
        <p className="text-lg font-semibold">{title} is coming soon!</p>
        <p className="max-w-md text-sm text-neutral-300">
          {description ?? "We&apos;re still building this game mode. Check back soon for a fresh way to test your anime knowledge."}
        </p>
      </div>
    </GameShell>
  );
}
