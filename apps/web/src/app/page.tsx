"use client";

import Image from "next/image";
import Link from "next/link";
import { MouseEvent, useCallback, useEffect, useMemo, useState } from "react";

import { GamePreviewModal } from "../components/GamePreviewModal";
import { GlassSection } from "../components/GlassSection";
import {
  type GameDirectoryEntry,
  type GamePreviewMedia,
} from "../config/games";
import {
  useDailyAvailability,
  useRuntimeGamesDirectory,
} from "../hooks/useDailyAvailability";
import { useAccount } from "../hooks/useAccount";
import { usePuzzleProgress } from "../hooks/usePuzzleProgress";
import { useStreak } from "../hooks/useStreak";
import { GameKey } from "../types/progress";
import {
  buildShareEvent,
  formatShareDate,
  formatShareEventMessage,
} from "../utils/shareText";
import { formatDurationFromMs, getNextResetIso } from "../utils/time";

const BASE_GAME_KEYS: readonly GameKey[] = [
  "anidle",
  "poster_zoomed",
  "character_silhouette",
  "redacted_synopsis",
];

type ProgressSummaryProps = {
  streakCount: number;
  timeRemaining: string | null;
  completedCount: number;
  totalAvailable: number;
};

function ProgressSummary({
  streakCount,
  timeRemaining,
  completedCount,
  totalAvailable,
}: ProgressSummaryProps): JSX.Element {
  const resetLabel = timeRemaining
    ? `Resets in ${timeRemaining}`
    : "Resets soon";

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/90 sm:text-base">
      <span className="inline-flex items-center gap-2 whitespace-nowrap font-medium text-amber-100">
        <span aria-hidden className="text-base sm:text-lg">
          🔥
        </span>
        <span className="block truncate">Streak {streakCount}</span>
      </span>
      <span className="inline-flex min-w-0 items-center gap-2 text-white/80">
        <span aria-hidden className="text-base sm:text-lg">
          ⏱️
        </span>
        <span className="block truncate sm:max-w-[16ch]">{resetLabel}</span>
      </span>
      <span className="inline-flex items-center gap-2 whitespace-nowrap text-white/80">
        <span aria-hidden className="text-base sm:text-lg">
          ✅
        </span>
        <span className="block truncate">
          {completedCount}/{totalAvailable} completed
        </span>
      </span>
    </div>
  );
}

function renderPreviewBackground(
  media: GamePreviewMedia | undefined,
  accentColor: string,
  overlayClasses: string,
): JSX.Element {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className={`absolute inset-0 bg-gradient-to-br ${accentColor}`} />
      {media ? (
        media.type === "image" ? (
          <div className="absolute inset-0">
            <div className="relative h-full w-full">
              <Image
                src={media.src}
                alt={media.alt}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
              />
            </div>
          </div>
        ) : (
          <video
            className="absolute inset-0 h-full w-full object-cover"
            src={media.src}
            autoPlay={media.autoPlay ?? true}
            loop={media.loop ?? true}
            muted={media.muted ?? true}
            playsInline
            aria-label={media.alt}
          />
        )
      ) : null}
      <div className="pointer-events-none absolute inset-0 bg-neutral-950/40" />
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accentColor} ${overlayClasses}`}
      />
    </div>
  );
}

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
  const nextResetIso = useMemo(() => getNextResetIso(todayIso), [todayIso]);
  const { account, loading: accountLoading } = useAccount();
  const { progress } = usePuzzleProgress(todayIso);
  const games = useRuntimeGamesDirectory();
  const { playableGames, upcomingGames } = useMemo(() => {
    const playable = games.filter((game) => game.playable);
    const upcoming = games.filter((game) => !game.playable);

    return { playableGames: playable, upcomingGames: upcoming };
  }, [games]);
  const firstPlayableGame = useMemo(
    () => playableGames.find((game) => game.playable) ?? null,
    [playableGames],
  );
  const {
    error: availabilityError,
    refresh: refreshAvailability,
    loading: availabilityLoading,
  } = useDailyAvailability();
  const showAvailabilityError = availabilityError;

  const nextIncompleteGame = useMemo(() => {
    for (const game of games) {
      if (!game.playable || !game.gameKey) {
        continue;
      }

      const gameProgress = progress[game.gameKey];

      if (!gameProgress?.completed) {
        return { slug: game.slug, title: game.title };
      }
    }

    return null;
  }, [games, progress]);

  const hasIncompleteGame = Boolean(nextIncompleteGame);

  const handleAvailabilityRetry = useCallback(() => {
    void refreshAvailability();
  }, [refreshAvailability]);

  const includeGuessTheOpening = useMemo(
    () =>
      games.some(
        (entry) => entry.slug === "guess-the-opening" && entry.playable,
      ),
    [games],
  );
  const keysToConsider: readonly GameKey[] = useMemo(
    () =>
      includeGuessTheOpening
        ? [...BASE_GAME_KEYS, "guess_the_opening"]
        : BASE_GAME_KEYS,
    [includeGuessTheOpening],
  );

  const totalAvailable = keysToConsider.length;
  const completedCount = keysToConsider.filter(
    (key) => progress[key]?.completed,
  ).length;
  const allCompleted = keysToConsider.every((key) => progress[key]?.completed);
  const streakInfo = useStreak(todayIso, allCompleted);
  const streakCount = streakInfo.count;

  const hasStartedAnyRounds = useMemo(() => {
    return keysToConsider.some((key) => {
      const entry = progress[key];
      if (!entry) {
        return false;
      }
      if (entry.completed) {
        return true;
      }
      if (Array.isArray(entry.guesses) && entry.guesses.length > 0) {
        return true;
      }
      return typeof entry.round === "number" && entry.round > 0;
    });
  }, [keysToConsider, progress]);

  const shareLocked = completedCount === 0 && !hasStartedAnyRounds;

  const shareEvent = useMemo(
    () =>
      buildShareEvent(todayIso, progress, {
        includeGuessTheOpening,
      }),
    [includeGuessTheOpening, progress, todayIso],
  );

  const shareMessage = useMemo(
    () => formatShareEventMessage(shareEvent),
    [shareEvent],
  );

  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!nextResetIso) {
      setTimeRemaining(null);
      return;
    }

    const targetTime = new Date(nextResetIso).getTime();
    if (Number.isNaN(targetTime)) {
      setTimeRemaining(null);
      return;
    }

    const updateTimeRemaining = () => {
      const diff = targetTime - Date.now();
      if (diff <= 0) {
        setTimeRemaining("00:00:00");
        return;
      }
      setTimeRemaining(formatDurationFromMs(diff));
    };

    updateTimeRemaining();
    const intervalId = window.setInterval(updateTimeRemaining, 1000);

    return () => window.clearInterval(intervalId);
  }, [nextResetIso]);

  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [previewGame, setPreviewGame] = useState<GameDirectoryEntry | null>(
    null,
  );

  const handleShare = useCallback(async () => {
    try {
      if (navigator.share) {
        await navigator.share({ text: shareMessage });
        setShareStatus("Shared");
        return;
      }
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareMessage);
        setShareStatus("Copied to clipboard");
        return;
      }
    } catch (error) {
      console.warn("Share cancelled", error);
    }
    setShareStatus("Unable to share on this device");
  }, [shareMessage]);

  useEffect(() => {
    if (shareLocked && shareStatus) {
      setShareStatus(null);
    }
  }, [shareLocked, shareStatus]);

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

  const upcomingUnlockLabels: Record<string, string> = useMemo(
    () => ({
      "guess-the-opening": "Unlocks once the remix playlist is ready.",
      "mystery-voice": "Arrives after voice-over licensing wraps up.",
      "emoji-synopsis": "Launching after the community vote closes.",
    }),
    [],
  );

  const showLoginCallout = !accountLoading && !account.authenticated;

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
            downloadable highlight cards that celebrate each win.
          </p>
          {showLoginCallout ? (
            <p className="text-sm leading-relaxed text-neutral-200/80">
              <Link
                href="/login"
                className="font-semibold text-white transition hover:text-brand-200"
              >
                Log in with AniList
              </Link>{" "}
              to sync your streaks and archive completions across every device.
            </p>
          ) : null}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="lg:hidden">
              <ProgressSummary
                streakCount={streakCount}
                timeRemaining={timeRemaining}
                completedCount={completedCount}
                totalAvailable={totalAvailable}
              />
            </div>
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
              <Link
                href={
                  hasIncompleteGame && nextIncompleteGame
                    ? `/games/${nextIncompleteGame.slug}`
                    : "/games/daily"
                }
                className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-brand-500 via-purple-500 to-pink-500 px-6 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.01] hover:shadow-[0_0_28px_rgba(147,51,234,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
              >
                {hasIncompleteGame
                  ? "Continue today’s run"
                  : "Play today's puzzles"}
              </Link>
              <button
                type="button"
                onClick={() => {
                  if (firstPlayableGame) {
                    handleOpenPreview(firstPlayableGame);
                  }
                }}
                disabled={!firstPlayableGame}
                className="text-sm font-semibold text-white/80 underline decoration-white/40 underline-offset-4 transition hover:text-white hover:decoration-white disabled:cursor-not-allowed disabled:text-white/40"
              >
                Watch a demo
              </button>
            </div>
          </div>
          <ul className="mt-8 space-y-3 text-lg leading-relaxed text-neutral-200">
            <li className="flex items-start gap-3">
              <span aria-hidden className="mt-0.5 text-xl">
                🎧
              </span>
              <span>
                <Link
                  href="/how-to-play"
                  className="font-semibold text-white transition hover:text-brand-200"
                >
                  Listen &amp; guess
                </Link>{" "}
                Catch audio clues, spot the reference, and see how it works in
                the full guide.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span aria-hidden className="mt-0.5 text-xl">
                🧩
              </span>
              <span>
                <Link
                  href="/how-to-play"
                  className="font-semibold text-white transition hover:text-brand-200"
                >
                  Unlock hints
                </Link>{" "}
                Learn when to reveal extra clues and strategize your hint usage
                step-by-step.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span aria-hidden className="mt-0.5 text-xl">
                📣
              </span>
              <span>
                <Link
                  href="/how-to-play"
                  className="font-semibold text-white transition hover:text-brand-200"
                >
                  Share your streak
                </Link>{" "}
                See tips for exporting recap cards and celebrating wins with your
                squad.
              </span>
            </li>
          </ul>
          {hasIncompleteGame ? (
            <p className="text-sm text-neutral-200/90">
              You left off on {nextIncompleteGame?.title}
            </p>
          ) : null}
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/3 bg-gradient-to-l from-brand-500/40 via-purple-500/20 to-transparent blur-3xl sm:block" />
      </section>

      <GlassSection innerClassName="space-y-6 text-neutral-200">
        <div className="space-y-2">
          <h2 className="text-2xl font-display font-semibold tracking-tight text-white">
            Today&apos;s progress
          </h2>
          <p className="text-sm text-neutral-300">
            Track your streak and completed games for {formattedDate}. Share or
            download a glossy recap card once you&apos;re done.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="hidden lg:block">
            <ProgressSummary
              streakCount={streakCount}
              timeRemaining={timeRemaining}
              completedCount={completedCount}
              totalAvailable={totalAvailable}
            />
          </div>
          {shareLocked ? (
            <div className="flex items-center gap-4 rounded-2xl border border-white/12 bg-white/10 px-4 py-3 text-left text-sm text-neutral-200/90">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 text-xl text-neutral-300">
                🔒
              </span>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white/85">
                  Play a round to unlock sharing
                </p>
                <p className="text-xs text-neutral-300/80">
                  Start any puzzle to generate a recap card worth sharing.
                </p>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-brand-500 via-purple-500 to-pink-500 px-5 py-2 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.01] hover:shadow-[0_0_25px_rgba(147,51,234,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
              onClick={handleShare}
            >
              Share progress
            </button>
          )}
        </div>
        {shareStatus && !shareLocked && (
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
        {playableGames.length > 0 ? (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">
              Available today
            </h3>
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {playableGames.map((game) => {
                const eyebrow = showAvailabilityError
                  ? "Status unavailable"
                  : game.playable
                    ? "Available now"
                    : game.comingSoon
                      ? "Coming soon"
                      : "Unavailable";
                const overlayClasses =
                  "opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100";
                const cardClasses =
                  "relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-surface-raised/80 p-6 text-white shadow-ambient backdrop-blur-xl transition group-hover:border-brand-400/50 group-hover:shadow-[0_0_40px_rgba(59,130,246,0.35)] group-focus-within:border-brand-400/50 group-focus-within:shadow-[0_0_40px_rgba(59,130,246,0.35)]";

                const progressForGame = game.gameKey
                  ? progress[game.gameKey]
                  : undefined;
                const canResume = Boolean(
                  progressForGame && !progressForGame.completed,
                );

                const handlePreviewClick = (
                  event?: MouseEvent<HTMLElement>,
                ) => {
                  event?.preventDefault();
                  event?.stopPropagation();
                  handleOpenPreview(game);
                };

                const content = (
                  <>
                    {renderPreviewBackground(
                      game.preview.media,
                      game.accentColor,
                      overlayClasses,
                    )}
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
                    {showAvailabilityError ? (
                      <div className="relative z-20 mt-6 flex flex-wrap items-center gap-3">
                        <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/15 px-3 py-1.5 text-sm font-medium text-amber-50">
                          ⚠️ Unable to load today&apos;s availability
                        </span>
                        <button
                          type="button"
                          onClick={handleAvailabilityRetry}
                          disabled={availabilityLoading}
                          className="inline-flex items-center justify-center rounded-2xl border border-amber-300/60 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:border-amber-200/70 hover:text-amber-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200/70"
                        >
                          Retry
                        </button>
                      </div>
                    ) : null}
                  </>
                );

                return (
                  <div key={game.slug} className="flex h-full flex-col gap-3">
                    <div className="group relative">
                      <div className={`${cardClasses} flex-1 text-left`}>
                        {content}
                      </div>
                      <Link
                        href={`/games/${game.slug}`}
                        aria-hidden="true"
                        tabIndex={-1}
                        className="absolute inset-0 z-10 rounded-3xl"
                      />
                      {!showAvailabilityError ? (
                        <Link
                          href={`/games/${game.slug}`}
                          className="pointer-events-auto absolute bottom-6 left-6 z-30 inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-brand-500 via-purple-500 to-pink-500 px-5 py-2 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.01] hover:shadow-[0_0_25px_rgba(147,51,234,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
                        >
                          {canResume ? "Resume" : "Start playing"}
                          <svg
                            aria-hidden
                            className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1 group-focus-within:translate-x-1"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path d="M7.293 4.707a1 1 0 011.414-1.414l5.586 5.586a1 1 0 010 1.414l-5.586 5.586a1 1 0 01-1.414-1.414L11.172 10 7.293 6.121a1 1 0 010-1.414z" />
                          </svg>
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        onClick={handlePreviewClick}
                        className="absolute right-4 top-4 z-40 inline-flex h-10 items-center gap-2 rounded-xl border border-white/20 bg-black/40 px-4 text-sm font-semibold text-white/90 shadow-ambient backdrop-blur transition hover:border-white/40 hover:bg-black/60 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
                      >
                        <svg
                          aria-hidden
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M1.5 12s3.5-7 10.5-7 10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        Preview game
                      </button>
                    </div>
                    {game.playable && canResume ? (
                      <span className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70">
                        Progress carries over when this mode launches
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
        {upcomingGames.length > 0 ? (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">On the horizon</h3>
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {upcomingGames.map((game) => {
                const eyebrow = showAvailabilityError
                  ? "Status unavailable"
                  : game.comingSoon
                    ? "Coming soon"
                    : "Unavailable";
                const statusLabel =
                  upcomingUnlockLabels[game.slug] ?? "Unlocking soon.";
                const statusClasses = "text-neutral-400";
                const overlayClasses = "opacity-70";
                const cardClasses =
                  "group relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/5 bg-surface-raised/60 p-6 text-white/80 shadow-ambient backdrop-blur-xl transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60";

                const progressForGame = game.gameKey
                  ? progress[game.gameKey]
                  : undefined;

                const handlePreviewClick = (
                  event?: MouseEvent<HTMLElement>,
                ) => {
                  event?.preventDefault();
                  event?.stopPropagation();
                  handleOpenPreview(game);
                };

                const content = (
                  <>
                    {renderPreviewBackground(
                      game.preview.media,
                      game.accentColor,
                      overlayClasses,
                    )}
                    <div className="relative z-10 flex flex-1 flex-col gap-4">
                      <span className="inline-flex w-fit items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-neutral-300">
                        {eyebrow}
                      </span>
                      <h3 className="text-xl font-display font-semibold tracking-tight text-white">
                        {game.title}
                      </h3>
                      <p className="text-sm leading-relaxed text-neutral-200/80">
                        {game.tagline}
                      </p>
                    </div>
                    <span
                      className={`relative z-10 mt-6 inline-flex items-center gap-2 text-sm font-semibold ${statusClasses}`}
                    >
                      {statusLabel}
                    </span>
                    {showAvailabilityError ? (
                      <div className="relative z-10 mt-6 flex flex-wrap items-center gap-3">
                        <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/15 px-3 py-1.5 text-sm font-medium text-amber-50">
                          ⚠️ Unable to load today&apos;s availability
                        </span>
                        <button
                          type="button"
                          onClick={handleAvailabilityRetry}
                          disabled={availabilityLoading}
                          className="inline-flex items-center justify-center rounded-2xl border border-amber-300/60 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:border-amber-200/70 hover:text-amber-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200/70"
                        >
                          Retry
                        </button>
                      </div>
                    ) : null}
                  </>
                );

                return (
                  <div key={game.slug} className="flex h-full flex-col gap-3">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={handlePreviewClick}
                        className={`${cardClasses} flex-1 text-left`}
                      >
                        {content}
                      </button>
                      <button
                        type="button"
                        onClick={handlePreviewClick}
                        className="absolute right-4 top-4 inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-4 text-sm font-semibold text-white/80 shadow-ambient backdrop-blur transition hover:border-white/20 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
                      >
                        <svg
                          aria-hidden
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M1.5 12s3.5-7 10.5-7 10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        Preview game
                      </button>
                    </div>
                    {progressForGame && !progressForGame.completed ? (
                      <span className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70">
                        Progress carries over when this mode launches
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
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
