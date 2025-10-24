"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { GamePreviewModal } from "../components/GamePreviewModal";
import { GlassSection } from "../components/GlassSection";
import { type GameDirectoryEntry } from "../config/games";
import { useRuntimeGamesDirectory } from "../hooks/useDailyAvailability";
import { usePuzzleProgress } from "../hooks/usePuzzleProgress";
import { useStreak } from "../hooks/useStreak";
import { GameKey } from "../types/progress";
import { buildShareText, formatShareDate } from "../utils/shareText";

function todayIsoDate(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function HomePage() {
  const todayIso = useMemo(() => todayIsoDate(), []);
  const formattedDate = useMemo(() => formatShareDate(todayIso), [todayIso]);
  const { progress } = usePuzzleProgress(todayIso);
  const games = useRuntimeGamesDirectory();

  const includeGuessTheOpening = useMemo(
    () => games.some((entry) => entry.slug === "guess-the-opening" && entry.playable),
    [games],
  );
  const baseKeys: GameKey[] = ["anidle", "poster_zoomed", "redacted_synopsis"];
  const keysToConsider: GameKey[] = includeGuessTheOpening
    ? [...baseKeys, "guess_the_opening"]
    : baseKeys;

  const totalAvailable = keysToConsider.length;
  const completedCount = keysToConsider.filter(
    (key) => progress[key]?.completed,
  ).length;
  const allCompleted = keysToConsider.every((key) => progress[key]?.completed);
  const streak = useStreak(todayIso, allCompleted);

  const shareText = useMemo(
    () =>
      buildShareText(todayIso, progress, {
        includeGuessTheOpening,
      }),
    [includeGuessTheOpening, progress, todayIso],
  );

  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [previewGame, setPreviewGame] = useState<GameDirectoryEntry | null>(null);

  const handleShare = useCallback(async () => {
    try {
      if (navigator.share) {
        await navigator.share({ text: shareText });
        setShareStatus("Shared");
        return;
      }
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareText);
        setShareStatus("Copied to clipboard");
        return;
      }
    } catch (error) {
      console.warn("Share cancelled", error);
    }
    setShareStatus("Unable to share on this device");
  }, [shareText]);

  useEffect(() => {
    if (!shareStatus) return;
    const timeout = window.setTimeout(() => setShareStatus(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [shareStatus]);

  const handleOpenPreview = useCallback((game: GameDirectoryEntry) => {
    setPreviewGame(game);
  }, []);

  const handleClosePreview = useCallback(() => {
    setPreviewGame(null);
  }, []);

  return (
    <div className="space-y-16">
      <section className="relative overflow-hidden rounded-4xl border border-white/10 bg-surface-raised p-10 text-white shadow-ambient backdrop-blur-2xl sm:p-16">
        <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-brand-400/60 to-transparent" />
        <div className="relative z-10 max-w-3xl space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-neutral-100/80">
            GuessSenpai
          </span>
          <h1 className="text-4xl font-display font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Anime guessing games with a glassy twist
          </h1>
          <p className="text-lg leading-relaxed text-neutral-200">
            Sharpen your encyclopedic knowledge of anime through daily rounds of
            metadata, posters, synopsis reveals, and a dash of musical
            nostalgia. Compete with friends, maintain your streak, and share
            your victories.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/games/daily"
              className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-brand-500 via-purple-500 to-pink-500 px-6 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.01] hover:shadow-[0_0_28px_rgba(147,51,234,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
            >
              Play today&apos;s puzzles
            </Link>
            <Link
              href="/how-to-play"
              className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-6 py-2.5 text-sm font-semibold text-white/90 shadow-ambient transition hover:border-brand-400/40 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
            >
              Learn the rules
            </Link>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/3 bg-gradient-to-l from-brand-500/40 via-purple-500/20 to-transparent blur-3xl sm:block" />
      </section>

      <GlassSection innerClassName="space-y-6 text-neutral-200">
        <div className="space-y-2">
          <h2 className="text-2xl font-display font-semibold tracking-tight text-white">
            Today&apos;s progress
          </h2>
          <p className="text-sm text-neutral-300">
            Track your streak and completed games for {formattedDate}. Share
            your results once you&apos;re done.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-gradient-to-r from-amber-400/25 via-amber-500/10 to-amber-400/25 px-4 py-1.5 text-sm font-medium text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-sm">
            🔥 Streak {streak}
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-sm font-medium text-white/90 backdrop-blur-sm">
            {completedCount}/{totalAvailable} completed
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-brand-500 via-purple-500 to-pink-500 px-5 py-2 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.01] hover:shadow-[0_0_25px_rgba(147,51,234,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
            onClick={handleShare}
          >
            Share progress
          </button>
        </div>
        {shareStatus && (
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs text-white/90 shadow-inner transition">
            {shareStatus}
          </p>
        )}
      </GlassSection>

      <section className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-display font-semibold tracking-tight text-white">
            Choose your game
          </h2>
          <p className="text-sm text-neutral-300">
            Jump into today&apos;s lineup or preview what&apos;s coming next.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {games.map((game) => {
            const eyebrow = game.playable
              ? "Available now"
              : game.comingSoon
                ? "Coming soon"
                : "Unavailable";
            const statusLabel = game.playable ? "Start playing" : "Coming soon";
            const statusClasses = game.playable
              ? "text-brand-200 transition group-hover:text-brand-100"
              : "text-neutral-300";
            const overlayClasses = game.playable
              ? "opacity-0 transition group-hover:opacity-100"
              : "opacity-80 transition";
            const cardClasses = `group relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-surface-raised/80 p-6 text-white shadow-ambient backdrop-blur-xl transition ${
              game.playable
                ? "hover:border-brand-400/50 hover:shadow-[0_0_40px_rgba(59,130,246,0.35)]"
                : "opacity-70"
            }`;

            const progressForGame = game.gameKey
              ? progress[game.gameKey]
              : undefined;
            const canResume = Boolean(
              progressForGame && !progressForGame.completed,
            );

            const handleCardClick = () => handleOpenPreview(game);

            const content = (
              <>
                <div
                  className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${game.accentColor} ${overlayClasses}`}
                />
                <div className="relative z-10 flex flex-1 flex-col gap-4">
                  <span className="inline-flex w-fit items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-neutral-200/80">
                    {eyebrow}
                  </span>
                  <h3 className="text-xl font-display font-semibold tracking-tight">
                    {game.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-neutral-200">
                    {game.tagline}
                  </p>
                </div>
                <span
                  className={`relative z-10 mt-6 inline-flex items-center gap-2 text-sm font-semibold ${statusClasses}`}
                >
                  {statusLabel}
                  {game.playable ? (
                    <svg
                      aria-hidden
                      className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M7.293 4.707a1 1 0 011.414-1.414l5.586 5.586a1 1 0 010 1.414l-5.586 5.586a1 1 0 01-1.414-1.414L11.172 10 7.293 6.121a1 1 0 010-1.414z" />
                    </svg>
                  ) : null}
                </span>
              </>
            );

            return (
              <div key={game.slug} className="flex h-full flex-col gap-3">
                <button
                  type="button"
                  onClick={handleCardClick}
                  className={`${cardClasses} flex-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80`}
                >
                  {content}
                </button>
                {game.playable && canResume ? (
                  <Link
                    href={`/games/${game.slug}`}
                    className="inline-flex items-center justify-center rounded-2xl border border-brand-400/40 bg-brand-400/10 px-4 py-2 text-sm font-semibold text-brand-100 transition hover:border-brand-300/60 hover:bg-brand-400/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
                  >
                    Resume
                  </Link>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
      <GamePreviewModal
        open={Boolean(previewGame)}
        game={previewGame}
        onClose={handleClosePreview}
        progress={
          previewGame?.gameKey ? progress[previewGame.gameKey] : undefined
        }
      />
    </div>
  );
}
