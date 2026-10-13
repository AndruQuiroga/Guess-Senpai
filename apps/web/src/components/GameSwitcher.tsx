"use client";

import Link from "next/link";

import { useRuntimeGamesDirectory } from "../hooks/useDailyAvailability";
import type { DailyProgress } from "../types/progress";
import { getGameAction, getGameOutcome } from "../utils/gameAction";

interface GameSwitcherProps {
  currentSlug?: string;
  progress?: DailyProgress;
}

/**
 * @deprecated Superseded by the persistent sidebar and mobile chip row
 * (PrimaryNav). GameShell no longer renders it; retained only for the dev
 * fixture and legacy tests. Safe to delete once those are migrated.
 */
export function GameSwitcher({ currentSlug, progress }: GameSwitcherProps) {
  const games = useRuntimeGamesDirectory().filter((game) => game.playable);
  if (games.length === 0) return null;

  return (
    <details className="relative">
      <summary className="button min-h-11 cursor-pointer list-none border border-[#484b4d] bg-[#2c2f31] text-sm text-[#f4f0e7]">
        Switch game <span aria-hidden="true">⌄</span>
      </summary>
      <nav
        aria-label="Switch games"
        className="absolute right-0 top-full z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] max-h-[min(24rem,calc(100dvh-8rem))] overflow-y-auto overscroll-contain rounded-lg border border-[#484b4d] bg-[#242628] p-2"
      >
        <ul className="space-y-1">
          {games.map((game) => {
            const gameProgress = game.gameKey
              ? progress?.[game.gameKey]
              : undefined;
            const action = getGameAction(gameProgress);
            const statusLabel =
              getGameOutcome(gameProgress) === "exhausted"
                ? "Out of guesses"
                : action === "results"
                  ? "✓ Results"
                  : action === "resume"
                    ? "↻ Resume"
                    : "Play";

            return (
              <li key={game.slug}>
                <Link
                  href={`/games/${game.slug}`}
                  aria-current={game.slug === currentSlug ? "page" : undefined}
                  className={`flex min-h-11 items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-semibold transition ${
                    game.slug === currentSlug
                      ? "bg-[#383a3c] text-[#f4f0e7]"
                      : "text-[#c1c2bd] hover:bg-[#2c2f31] hover:text-white"
                  }`}
                >
                  <span>{game.title}</span>
                  <span className="shrink-0 text-[#ff987f]">{statusLabel}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </details>
  );
}

export default GameSwitcher;
