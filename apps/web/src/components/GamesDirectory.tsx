"use client";

import Link from "next/link";

import { GlassSection } from "./GlassSection";
import { useRuntimeGamesDirectory } from "../hooks/useDailyAvailability";

function GameStatusTag({ playable, comingSoon }: { playable: boolean; comingSoon: boolean }) {
  const baseClassName =
    "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em]";

  if (playable) {
    return (
      <span className={`${baseClassName} border-brand-300/40 bg-brand-500/10 text-brand-200`}>Available now</span>
    );
  }

  if (comingSoon) {
    return (
      <span className={`${baseClassName} border-white/15 bg-white/5 text-neutral-200/90`}>Coming soon</span>
    );
  }

  return (
    <span className={`${baseClassName} border-white/10 bg-white/5 text-neutral-400`}>Unavailable</span>
  );
}

export default function GamesDirectory() {
  const games = useRuntimeGamesDirectory();

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {games.map((game) => {
        const placeholder = game.preview.placeholder;

        return (
          <GlassSection
            key={game.slug}
            className="group relative h-full border-white/10 bg-white/5"
            innerClassName="flex h-full flex-col gap-6"
          >
            <div
              aria-hidden
              className={`pointer-events-none absolute -inset-12 -z-10 bg-gradient-to-br ${game.accentColor} opacity-20 blur-3xl transition duration-500 group-hover:opacity-35`}
            />

            <div className="space-y-4">
              <GameStatusTag playable={game.playable} comingSoon={game.comingSoon} />

              <div className="space-y-2">
                <h2 className="text-2xl font-display font-semibold tracking-tight text-white">
                  {game.title}
                </h2>
                <p className="text-sm uppercase tracking-[0.3em] text-neutral-400">{game.tagline}</p>
              </div>

              {game.description ? (
                <p className="text-sm leading-relaxed text-neutral-200/90">{game.description}</p>
              ) : null}
            </div>

            {placeholder ? (
              <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-neutral-200/90">
                {placeholder.icon ? (
                  <span aria-hidden className="text-lg">
                    {placeholder.icon}
                  </span>
                ) : null}
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-white">{placeholder.headline}</p>
                  <p className="text-xs leading-relaxed text-neutral-300/90">{placeholder.description}</p>
                </div>
              </div>
            ) : null}

            <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
              <span className="text-xs uppercase tracking-[0.28em] text-neutral-400">
                {game.playable ? "Ready to play" : game.comingSoon ? "In development" : "Currently unavailable"}
              </span>

              {game.playable ? (
                <Link
                  href={`/games/${game.slug}`}
                  className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-brand-500 via-purple-500 to-pink-500 px-5 py-2 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.01] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
                >
                  Play now
                </Link>
              ) : (
                <span className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-2 text-sm font-semibold text-neutral-300/80">
                  Coming soon
                </span>
              )}
            </div>
          </GlassSection>
        );
      })}
    </div>
  );
}
