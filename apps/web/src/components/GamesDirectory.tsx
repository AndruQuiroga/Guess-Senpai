"use client";

import { useMemo } from "react";
import Link from "next/link";

import { PanelSection } from "./PanelSection";
import type { GameDirectoryEntry } from "../config/games";
import { useRuntimeGamesDirectory } from "../hooks/useDailyAvailability";

type GameFilter = "all" | "available" | "coming-soon";

function GameStatusTag({
  playable,
  comingSoon,
}: {
  playable: boolean;
  comingSoon: boolean;
}) {
  const baseClassName =
    "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em]";

  if (playable) {
    return (
      <span
        className={`${baseClassName} border-[#ff7658] bg-[#3a2a25] text-brand-200`}
      >
        Available now
      </span>
    );
  }

  if (comingSoon) {
    return (
      <span
        className={`${baseClassName} border-[#686b6d] bg-[#242628] text-[#c1c2bd]`}
      >
        Coming soon
      </span>
    );
  }

  return (
    <span
      className={`${baseClassName} border-[#484b4d] bg-[#242628] text-neutral-400`}
    >
      Unavailable
    </span>
  );
}

interface GamesDirectoryProps {
  filter: GameFilter;
}

function matchesFilter(game: GameDirectoryEntry, filter: GameFilter): boolean {
  if (filter === "available") {
    return game.playable;
  }

  if (filter === "coming-soon") {
    return game.comingSoon;
  }

  return true;
}

export default function GamesDirectory({ filter }: GamesDirectoryProps) {
  const games = useRuntimeGamesDirectory();
  const filteredGames = useMemo(
    () => games.filter((game) => matchesFilter(game, filter)),
    [games, filter],
  );

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {filteredGames.map((game) => {
        const placeholder = game.preview.placeholder;

        return (
          <PanelSection
            key={game.slug}
            className="h-full"
            innerClassName="flex h-full flex-col gap-6"
          >
            <div className="space-y-4">
              <GameStatusTag
                playable={game.playable}
                comingSoon={game.comingSoon}
              />

              <div className="space-y-2">
                <h2 className="text-2xl font-display font-semibold tracking-tight text-[#f4f0e7]">
                  {game.title}
                </h2>
                <p className="text-sm uppercase tracking-[0.3em] text-neutral-400">
                  {game.tagline}
                </p>
              </div>

              {game.description ? (
                <p className="text-sm leading-relaxed text-[#c1c2bd]">
                  {game.description}
                </p>
              ) : null}
            </div>

            {placeholder ? (
              <div className="flex items-start gap-3 rounded-lg border border-[#484b4d] bg-[#242628] p-4 text-sm text-[#c1c2bd]">
                {placeholder.icon ? (
                  <span aria-hidden className="text-lg">
                    {placeholder.icon}
                  </span>
                ) : null}
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[#f4f0e7]">
                    {placeholder.headline}
                  </p>
                  <p className="text-xs leading-relaxed text-[#c1c2bd]">
                    {placeholder.description}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
              <span className="text-xs uppercase tracking-[0.28em] text-neutral-400">
                {game.playable
                  ? "Ready to play"
                  : game.comingSoon
                    ? "In development"
                    : "Currently unavailable"}
              </span>

              {game.playable ? (
                <Link
                  href={`/games/${game.slug}`}
                  className="inline-flex items-center justify-center rounded-lg border border-[#ff7658] bg-[#ff7658] hover:bg-[#ff8a70] px-5 py-2 text-sm font-semibold text-[#27110b] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
                >
                  Play now
                </Link>
              ) : (
                <span className="inline-flex items-center justify-center rounded-lg border border-[#484b4d] bg-[#242628] px-5 py-2 text-sm font-semibold text-[#c1c2bd]">
                  Coming soon
                </span>
              )}
            </div>
          </PanelSection>
        );
      })}
    </div>
  );
}
