"use client";

import Link from "next/link";

import { useRuntimeGamesDirectory } from "../hooks/useDailyAvailability";
import type { DailyProgress, GameProgress } from "../types/progress";

interface GameSwitcherProps {
  currentSlug?: string;
  progress?: DailyProgress;
}

type GameStatus = "completed" | "in-progress" | null;

function determineStatus(entry?: GameProgress): GameStatus {
  if (!entry) {
    return null;
  }

  if (entry.completed) {
    return "completed";
  }

  if (entry.round > 1 || (entry.guesses?.length ?? 0) > 0) {
    return "in-progress";
  }

  return null;
}

export function GameSwitcher({ currentSlug, progress }: GameSwitcherProps) {
  const games = useRuntimeGamesDirectory();
  const availableGames = games.filter((game) => game.playable);

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
          const status = determineStatus(
            game.gameKey ? progress?.[game.gameKey] : undefined,
          );

          const statusLabel =
            status === "completed"
              ? "Completed"
              : status === "in-progress"
                ? "In progress"
                : null;

          const statusDisplay =
            status === "completed"
              ? "✓"
              : status === "in-progress"
                ? "•"
                : null;

          const statusClassName =
            status === "completed"
              ? "border-emerald-300/50 bg-emerald-400/25 text-emerald-100"
              : status === "in-progress"
                ? "border-amber-300/50 bg-amber-400/25 text-amber-100"
                : "";

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
              title={game.description ?? undefined}
            >
              <span className="inline-flex items-center gap-1">
                <span>{game.title}</span>
                {statusLabel && statusDisplay ? (
                  <span
                    className={[
                      "inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[0.55rem] font-semibold leading-none shadow-[0_1px_1px_rgba(0,0,0,0.2)]",
                      statusClassName || "border-white/20 bg-white/15 text-white/90",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-label={statusLabel}
                  >
                    <span aria-hidden="true">{statusDisplay}</span>
                  </span>
                ) : null}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default GameSwitcher;
