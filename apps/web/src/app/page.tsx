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
import { showToast } from "../utils/toast";
import { formatDurationFromMs, getNextResetIso } from "../utils/time";

const BASE_GAME_KEYS: readonly GameKey[] = [
  "anidle",
  "poster_zoomed",
  "character_silhouette",
  "redacted_synopsis",
];

type ProgressSummaryChunk = {
  id: "streak" | "reset" | "completion";
  icon: string;
  text: string;
  textClassName?: string;
  accent?: "highlight" | "neutral";
};

type ProgressSummaryProps = {
  chunks: ProgressSummaryChunk[];
  className?: string;
  layout?: "inline" | "pill";
};

function classNames(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

function createProgressSummaryChunks({
  streakCount,
  timeRemaining,
  completedCount,
  totalAvailable,
}: {
  streakCount: number;
  timeRemaining: string | null;
  completedCount: number;
  totalAvailable: number;
}): ProgressSummaryChunk[] {
  const resetLabel = timeRemaining
    ? `Resets in ${timeRemaining}`
    : "Resets soon";

  return [
    {
      id: "streak",
      icon: "🔥",
      text: `Streak ${streakCount}`,
      accent: "highlight",
    },
    {
      id: "reset",
      icon: "⏱️",
      text: resetLabel,
      textClassName: "sm:max-w-[16ch]",
    },
    {
      id: "completion",
      icon: "✅",
      text: `${completedCount}/${totalAvailable} completed`,
    },
  ];
}

function ProgressSummaryChip({
  chunk,
  layout = "inline",
}: {
  chunk: ProgressSummaryChunk;
  layout?: "inline" | "pill";
}): JSX.Element {
  const wrapperClasses =
    layout === "inline"
      ? classNames(
          "inline-flex min-w-0 items-center gap-2 whitespace-nowrap text-white/80",
          chunk.accent === "highlight" && "font-medium text-amber-100",
        )
      : classNames(
          "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold shadow-ambient backdrop-blur-sm sm:text-sm",
          chunk.accent === "highlight"
            ? "border border-amber-300/60 bg-amber-400/15 text-amber-50"
            : "border border-white/15 bg-white/10 text-white/85",
        );

  const iconClasses =
    layout === "inline" ? "text-base sm:text-lg" : "text-sm sm:text-base";

  const labelClasses =
    layout === "inline"
      ? classNames("block truncate", chunk.textClassName)
      : classNames("truncate", chunk.textClassName);

  return (
    <span className={wrapperClasses}>
      <span aria-hidden className={iconClasses}>
        {chunk.icon}
      </span>
      <span className={labelClasses}>{chunk.text}</span>
    </span>
  );
}

function ProgressSummary({
  chunks,
  className,
  layout = "inline",
}: ProgressSummaryProps): JSX.Element {
  return (
    <div
      className={classNames(
        "flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/90 sm:text-base",
        className,
      )}
    >
      {chunks.map((chunk) => (
        <ProgressSummaryChip key={chunk.id} chunk={chunk} layout={layout} />
      ))}
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
      <div className="absolute inset-0 bg-neutral-950/70" aria-hidden />
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
            autoPlay={media.requiresAutoplay ?? media.autoPlay ?? false}
            loop={media.loop ?? true}
            muted={media.muted ?? true}
            playsInline
            aria-label={media.alt}
            preload="metadata"
          />
        )
      ) : null}
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

  const [previewGame, setPreviewGame] = useState<GameDirectoryEntry | null>(
    null,
  );

  const handleShare = useCallback(async () => {
    try {
      if (navigator.share) {
        await navigator.share({ text: shareMessage });
        showToast("Progress shared", "success");
        return;
      }
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareMessage);
        showToast("Copied to clipboard", "success");
        return;
      }
    } catch (error) {
      console.warn("Share cancelled", error);
    }
    showToast("Unable to share on this device", "error");
  }, [shareMessage]);

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
  const progressChunks = useMemo(
    () =>
      createProgressSummaryChunks({
        streakCount,
        timeRemaining,
        completedCount,
        totalAvailable,
      }),
    [streakCount, timeRemaining, completedCount, totalAvailable],
  );

  return (
    <div className="space-y-16">
      <GlassSection
        innerClassName="space-y-6 text-neutral-200"
        hoverGlow={false}
        borderIntensity="subtle"
        showAccent={false}
      >
        <div className="space-y-2">
          <h2 className="text-2xl font-display font-semibold tracking-tight text-white">
            Today&apos;s progress
          </h2>
          <p className="text-sm text-neutral-300">
            Track your streak and completed games for {formattedDate}. Share or
            download a glossy recap card once you&apos;re done.
          </p>
        </div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <ProgressSummary chunks={progressChunks} />
          {shareLocked ? (
            <p className="flex items-center gap-2 text-sm text-neutral-300/90">
              <span aria-hidden className="text-base">
                🔒
              </span>
              <span>Play a round to unlock sharing.</span>
            </p>
          ) : (
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/10 px-5 py-2 text-sm font-semibold text-white/90 shadow-ambient transition hover:border-brand-400/40 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
              onClick={handleShare}
            >
              Share progress
            </button>
          )}
        </div>
      </GlassSection>

      <section className="relative overflow-hidden rounded-4xl border border-white/10 bg-surface-raised p-10 text-white shadow-ambient backdrop-blur-2xl sm:p-14">
        <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-brand-400/60 to-transparent" />
        <div className="relative z-10 max-w-2xl space-y-5">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-neutral-100/80">
            GuessSenpai
          </span>
          <h1 className="text-3xl font-display font-semibold tracking-tight sm:text-4xl lg:text-[2.75rem]">
            Your daily anime guess sprint
          </h1>
          <p className="text-base leading-relaxed text-neutral-200/90 sm:text-lg">
            Guess the series, flex your trivia brain, and keep the streak alive.
            Tap in for fresh puzzles before the clock resets.
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
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <Link
                href={
                  hasIncompleteGame && nextIncompleteGame
                    ? `/games/${nextIncompleteGame.slug}`
                    : "/games/daily"
                }
                className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-brand-500 via-purple-500 to-pink-500 px-7 py-3 text-base font-semibold text-white shadow-glow transition hover:scale-[1.01] hover:shadow-[0_0_28px_rgba(147,51,234,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
              >
                {hasIncompleteGame && nextIncompleteGame
                  ? `Resume ${nextIncompleteGame.title}`
                  : "Play today’s lineup"}
              </Link>
              {hasIncompleteGame ? (
                <Link
                  href="/games/daily"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-white/85 transition hover:border-white/40 hover:text-white"
                >
                  Continue
                </Link>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              {progressChunks.map((chunk) => (
                <ProgressSummaryChip
                  key={chunk.id}
                  chunk={chunk}
                  layout="pill"
                />
              ))}
            </div>
          </div>
          {hasIncompleteGame ? (
            <p className="text-sm text-neutral-200/90">
              You left off on {nextIncompleteGame?.title}
            </p>
          ) : null}
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/3 bg-gradient-to-l from-brand-500/40 via-purple-500/20 to-transparent blur-3xl sm:block" />
      </section>

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
                  "opacity-75 mix-blend-multiply saturate-150";
                const cardClasses =
                  "relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-surface-raised/70 p-6 text-white shadow-ambient backdrop-blur-xl transition hover:border-white/20 focus-within:border-white/25";

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

                const previewButton = (
                  <button
                    type="button"
                    onClick={handlePreviewClick}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-black/40 text-white/80 shadow-ambient backdrop-blur transition hover:border-white/30 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
                    aria-label="Preview game"
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
                    <span className="sr-only">Preview game</span>
                  </button>
                );

                const actionCta = showAvailabilityError ? null : (
                  <Link
                    href={`/games/${game.slug}`}
                    className="group inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white shadow-ambient transition hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
                  >
                    {canResume ? "Resume" : "Start playing"}
                    <svg
                      aria-hidden
                      className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1 group-focus-visible:translate-x-1"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M7.293 4.707a1 1 0 011.414-1.414l5.586 5.586a1 1 0 010 1.414l-5.586 5.586a1 1 0 01-1.414-1.414L11.172 10 7.293 6.121a1 1 0 010-1.414z" />
                    </svg>
                  </Link>
                );

                const content = (
                  <>
                    {renderPreviewBackground(
                      game.preview.media,
                      game.accentColor,
                      overlayClasses,
                    )}
                    <div className="relative z-10 flex flex-1 flex-col gap-4">
                      <span className="inline-flex w-fit items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-white/80">
                        {eyebrow}
                      </span>
                      <h3 className="text-xl font-display font-semibold tracking-tight">
                        {game.title}
                      </h3>
                      <p className="text-sm leading-relaxed text-neutral-100/90">
                        {game.tagline}
                      </p>
                      <div className="mt-auto flex flex-col gap-4">
                        {showAvailabilityError ? (
                          <div className="flex flex-wrap items-center gap-3">
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
                        ) : (
                          <div className="flex items-center justify-between gap-3">
                            {actionCta}
                            {previewButton}
                          </div>
                        )}
                        {showAvailabilityError ? (
                          <div className="flex justify-end">
                            {previewButton}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </>
                );

                return (
                  <div key={game.slug} className="flex h-full flex-col gap-3">
                    <div className={cardClasses}>{content}</div>
                    {game.playable && canResume ? (
                      <p className="text-sm text-neutral-400">
                        Progress carries over when this mode launches
                      </p>
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
                const overlayClasses =
                  "opacity-85 mix-blend-multiply saturate-150";
                const cardClasses =
                  "group relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/5 bg-surface-raised/65 p-6 text-white shadow-ambient backdrop-blur-xl transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60";

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
                      <span className="inline-flex w-fit items-center rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-white/80">
                        {eyebrow}
                      </span>
                      <h3 className="text-xl font-display font-semibold tracking-tight text-white">
                        {game.title}
                      </h3>
                      <p className="text-sm leading-relaxed text-neutral-100/85">
                        {game.tagline}
                      </p>
                      <div className="mt-auto space-y-3 text-sm text-neutral-200/90">
                        <span className="font-medium text-neutral-100">
                          {statusLabel}
                        </span>
                        <span className="inline-flex items-center gap-2 text-neutral-100/80">
                          Preview details
                          <svg
                            aria-hidden
                            className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1 group-focus-visible:translate-x-1"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path d="M7.293 4.707a1 1 0 011.414-1.414l5.586 5.586a1 1 0 010 1.414l-5.586 5.586a1 1 0 01-1.414-1.414L11.172 10 7.293 6.121a1 1 0 010-1.414z" />
                          </svg>
                        </span>
                        {showAvailabilityError ? (
                          <div className="flex flex-wrap items-center gap-3 pt-1">
                            <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/15 px-3 py-1.5 font-medium text-amber-50">
                              ⚠️ Unable to load today&apos;s availability
                            </span>
                            <button
                              type="button"
                              onClick={handleAvailabilityRetry}
                              disabled={availabilityLoading}
                              className="inline-flex items-center justify-center rounded-2xl border border-amber-300/60 bg-amber-400/10 px-4 py-2 font-semibold text-amber-100 transition hover:border-amber-200/70 hover:text-amber-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200/70"
                            >
                              Retry
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </>
                );

                return (
                  <div key={game.slug} className="flex h-full flex-col gap-3">
                    <button
                      type="button"
                      onClick={handlePreviewClick}
                      className={`${cardClasses} flex-1 text-left`}
                    >
                      {content}
                    </button>
                    {progressForGame && !progressForGame.completed ? (
                      <p className="text-sm text-neutral-400">
                        Progress carries over when this mode launches
                      </p>
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
