"use client";

import { useMemo, useState } from "react";

import GamesDirectory from "../../components/GamesDirectory";
import { useRuntimeGamesDirectory } from "../../hooks/useDailyAvailability";

type GameFilter = "all" | "available" | "coming-soon";

interface FilterDefinition {
  label: string;
  value: GameFilter;
}

const FILTERS: FilterDefinition[] = [
  { label: "All", value: "all" },
  { label: "Available", value: "available" },
  { label: "Coming soon", value: "coming-soon" },
];

export default function GamesDirectorySection() {
  const games = useRuntimeGamesDirectory();
  const [activeFilter, setActiveFilter] = useState<GameFilter>("all");

  const counts = useMemo<Record<GameFilter, number>>(
    () => ({
      all: games.length,
      available: games.filter((game) => game.playable).length,
      "coming-soon": games.filter((game) => game.comingSoon).length,
    }),
    [games],
  );

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-center gap-3">
        {FILTERS.map(({ label, value }) => {
          const isActive = value === activeFilter;
          const count = counts[value];

          return (
            <button
              key={value}
              type="button"
              onClick={() => setActiveFilter(value)}
              className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80 ${
                isActive
                  ? "border-line-strong bg-panel-raised text-paper"
                  : "border-line bg-panel text-muted hover:border-line-strong hover:bg-panel-raised"
              }`}
            >
              <span className="flex items-center gap-1 uppercase tracking-[0.18em]">
                {label}
                <span className="text-xs text-muted">({count})</span>
              </span>
            </button>
          );
        })}
      </div>

      <GamesDirectory filter={activeFilter} />
    </section>
  );
}
