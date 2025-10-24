"use client";

import Link from "next/link";

import { GAMES_DIRECTORY } from "../config/games";

interface GameSwitcherProps {
  currentSlug?: string;
}

export function GameSwitcher({ currentSlug }: GameSwitcherProps) {
  const availableGames = GAMES_DIRECTORY.filter((game) => game.playable);

  if (availableGames.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Switch games"
      className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-xs text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl"
    >
      <span className="hidden uppercase tracking-[0.28em] text-[0.6rem] text-white/70 sm:inline">
        Games
      </span>
      <div className="flex items-center gap-1">
        {availableGames.map((game) => {
          const isActive = game.slug === currentSlug;

          return (
            <Link
              key={game.slug}
              href={`/games/${game.slug}`}
              className={[
                "inline-flex items-center rounded-full px-3 py-1 text-[0.7rem] font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70",
                isActive
                  ? "bg-white/25 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.28)]"
                  : "text-white/85 hover:bg-white/15 hover:text-white",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-current={isActive ? "page" : undefined}
            >
              {game.title}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default GameSwitcher;
