"use client";

import Image from "next/image";
import Link from "next/link";
import { MouseEvent, useCallback, useEffect, useMemo, useState } from "react";

import { DailyCompletionBanner } from "../components/DailyCompletionBanner";
import { GamePreviewModal } from "../components/GamePreviewModal";
import {
  HomeHero,
  type HeroCta,
  type ProgressSummaryChunk,
} from "../components/HomeHero";
import { ShareRecapCard } from "../components/ShareRecapCard";
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
  type ShareEventData,
} from "../utils/shareText";
import { formatDurationFromMs, getNextResetIso } from "../utils/time";

const BASE_GAME_KEYS: readonly GameKey[] = [
  "anidle",
  "poster_zoomed",
  "character_silhouette",
  "redacted_synopsis",
];

type StatusTone = "resume" | "available" | "comingSoon" | "locked" | "warning";

type StatusChipConfig = {
  label: string;
  tone: StatusTone;
};

const STATUS_TONE_STYLES: Record<
  StatusTone,
  { icon: string; className: string }
> = {
  resume: {
    icon: "↺",
    className:
      "border-emerald-300/50 bg-emerald-400/15 text-emerald-50 shadow-[0_0_25px_-12px_rgba(16,185,129,0.8)]",
  },
  available: {
    icon: "✨",
    className:
      "border-brand-300/50 bg-brand-400/15 text-brand-50 shadow-[0_0_25px_-12px_rgba(168,85,247,0.7)]",
  },
  comingSoon: {
    icon: "⏳",
    className:
      "border-amber-300/50 bg-amber-400/15 text-amber-50 shadow-[0_0_25px_-12px_rgba(251,191,36,0.8)]",
  },
  locked: {
    icon: "🔒",
    className:
      "border-white/20 bg-white/10 text-white/85 shadow-[0_0_20px_-12px_rgba(148,163,184,0.75)]",
  },
  warning: {
    icon: "⚠️",
    className:
      "border-amber-400/60 bg-amber-500/10 text-amber-100 shadow-[0_0_25px_-12px_rgba(251,191,36,0.6)]",
  },
};

function classNames(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

function createProgressSummaryChunks({
  streakCount,
  completedCount,
  totalAvailable,
}: {
  streakCount: number;
  completedCount: number;
  totalAvailable: number;
}): ProgressSummaryChunk[] {
  return [
    {
      id: "streak",
      icon: "🔥",
      text: `Streak ${streakCount}`,
      accent: "highlight",
    },
    {
      id: "completion",
      icon: "✅",
      text: `${completedCount}/${totalAvailable} completed`,
    },
  ];
}

function StatusChip({
  config,
  className,
}: {
  config: StatusChipConfig;
  className?: string;
}): JSX.Element {
  const toneStyles = STATUS_TONE_STYLES[config.tone];

  return (
    <span
      className={classNames(
        "inline-flex items-center gap-2 rounded-2xl border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] transition",
        toneStyles.className,
        className,
      )}
    >
      <span aria-hidden>{toneStyles.icon}</span>
      <span>{config.label}</span>
    </span>
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

  const shareEvent = useMemo<ShareEventData>(
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

  const shareFileName = useMemo(
    () => `guesssenpai-${todayIso}-share`,
    [todayIso],
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
        completedCount,
        totalAvailable,
      }),
    [streakCount, completedCount, totalAvailable],
  );

  const showCompletionBanner = allCompleted;

  const primaryCta: HeroCta | undefined = !showCompletionBanner
    ? hasIncompleteGame && nextIncompleteGame
      ? {
          href: `/games/${nextIncompleteGame.slug}`,
          label: `Resume ${nextIncompleteGame.title}`,
        }
      : { href: "/games/daily", label: "Play today’s lineup" }
    : undefined;

  const secondaryCta: HeroCta | undefined =
    !showCompletionBanner && hasIncompleteGame
      ? { href: "/games/daily", label: "Continue" }
      : undefined;

  return (
    <div className="space-y-16">
      <HomeHero
        formattedDate={formattedDate}
        streakInfo={streakInfo}
        progressChunks={progressChunks}
        showLoginCallout={showLoginCallout}
        primaryCta={primaryCta}
        secondaryCta={secondaryCta}
        nextIncompleteGame={nextIncompleteGame}
        timeRemaining={timeRemaining}
      />

      {showCompletionBanner ? (
        <DailyCompletionBanner timeRemaining={timeRemaining} />
      ) : null}

      {allCompleted ? (
        <ShareRecapCard
          event={shareEvent}
          shareMessage={shareMessage}
          fileName={shareFileName}
          streakCount={streakCount}
        />
      ) : null}

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
          <div className="space-y-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
              <h3 className="text-lg font-semibold text-white">
                Available today
              </h3>
              <p className="text-sm text-neutral-300/90">
                Modern cards highlight what you can play now—tap in or preview
                the run.
              </p>
            </div>
            <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
              {playableGames.map((game, index) => {
                const overlayClasses =
                  index === 0 && playableGames.length > 1
                    ? "opacity-70 mix-blend-multiply saturate-150"
                    : "opacity-80 mix-blend-multiply saturate-125";
                const isHero = index === 0 && playableGames.length > 1;
                const progressForGame = game.gameKey
                  ? progress[game.gameKey]
                  : undefined;
                const canResume = Boolean(
                  progressForGame && !progressForGame.completed,
                );
                const statusChip: StatusChipConfig = showAvailabilityError
                  ? { tone: "warning", label: "Status unavailable" }
                  : canResume
                    ? { tone: "resume", label: "Resume run" }
                    : { tone: "available", label: "Ready today" };

                const secondaryInfo = canResume
                  ? "Pick up where you left off."
                  : progressForGame?.completed
                    ? "Cleared for today—replay for streak practice."
                    : "Three rounds stand between you and the win.";

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
                    className="inline-flex items-center gap-2 rounded-3xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/85 transition hover:border-white/30 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
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
                    Preview
                  </button>
                );

                const primaryCta = showAvailabilityError ? null : (
                  <Link
                    href={`/games/${game.slug}`}
                    className="group inline-flex items-center gap-2 rounded-3xl border border-brand-300/50 bg-gradient-to-r from-brand-500 via-purple-500 to-amber-400 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_20px_45px_-28px_rgba(236,72,153,0.75)] transition hover:scale-[1.015] hover:shadow-[0_24px_60px_-28px_rgba(236,72,153,0.75)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
                  >
                    {canResume ? "Resume now" : "Play mode"}
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

                return (
                  <article
                    key={game.slug}
                    className={classNames(
                      "relative flex",
                      isHero ? "lg:col-span-2 xl:col-span-2" : "",
                    )}
                  >
                    <div
                      className={classNames(
                        "group relative flex h-full w-full flex-col overflow-hidden rounded-4xl border border-white/10 bg-surface-raised/70 p-7 text-white shadow-ambient backdrop-blur-2xl transition hover:border-white/25 focus-within:border-white/25",
                        isHero ? "lg:p-9" : "",
                      )}
                    >
                      {renderPreviewBackground(
                        game.preview.media,
                        game.accentColor,
                        overlayClasses,
                      )}
                      <div className="relative z-10 flex h-full flex-col gap-6">
                        <div className="flex items-start justify-between gap-3">
                          <StatusChip
                            config={statusChip}
                            className="text-[0.6rem] text-white/90 sm:text-[0.7rem]"
                          />
                          {previewButton}
                        </div>
                        <div className="space-y-3">
                          <h3
                            className={classNames(
                              "font-display font-semibold tracking-tight text-white",
                              isHero ? "text-2xl sm:text-3xl" : "text-xl",
                            )}
                          >
                            {game.title}
                          </h3>
                          <p className="max-w-xl text-sm leading-relaxed text-neutral-100/85 sm:text-base">
                            {game.tagline}
                          </p>
                        </div>
                        <div className="flex flex-1 flex-col justify-end gap-4 text-sm text-neutral-200/90">
                          <p className="text-neutral-100/85">{secondaryInfo}</p>
                          {showAvailabilityError ? (
                            <div className="flex flex-wrap items-center gap-3">
                              <StatusChip
                                config={{
                                  tone: "warning",
                                  label: "Unable to load availability",
                                }}
                              />
                              <button
                                type="button"
                                onClick={handleAvailabilityRetry}
                                disabled={availabilityLoading}
                                className="inline-flex items-center gap-2 rounded-3xl border border-amber-300/60 bg-amber-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-100 transition hover:border-amber-200/70 hover:text-amber-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200/70"
                              >
                                Retry
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center gap-3">
                              {primaryCta}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ) : null}
        {upcomingGames.length > 0 ? (
          <div className="space-y-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
              <h3 className="text-lg font-semibold text-white">
                On the horizon
              </h3>
              <p className="text-sm text-neutral-300/90">
                Peek at what unlocks next. Preview screens still work while
                modes are in prep.
              </p>
            </div>
            <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
              {upcomingGames.map((game) => {
                const overlayClasses =
                  "opacity-85 mix-blend-multiply saturate-150";
                const statusChip: StatusChipConfig = showAvailabilityError
                  ? { tone: "warning", label: "Status unavailable" }
                  : game.comingSoon
                    ? { tone: "comingSoon", label: "Coming soon" }
                    : { tone: "locked", label: "Locked" };
                const statusLabel =
                  upcomingUnlockLabels[game.slug] ?? "Unlocking soon.";
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

                return (
                  <article key={game.slug} className="relative flex">
                    <button
                      type="button"
                      onClick={handlePreviewClick}
                      className="group relative flex h-full w-full flex-col overflow-hidden rounded-4xl border border-white/8 bg-surface-raised/65 p-7 text-left text-white shadow-ambient backdrop-blur-2xl transition hover:border-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/65"
                    >
                      {renderPreviewBackground(
                        game.preview.media,
                        game.accentColor,
                        overlayClasses,
                      )}
                      <div className="relative z-10 flex h-full flex-col gap-6">
                        <div className="flex items-start justify-between gap-3">
                          <StatusChip
                            config={statusChip}
                            className="text-[0.6rem] text-white/90 sm:text-[0.7rem]"
                          />
                          <span className="inline-flex items-center gap-1 rounded-2xl border border-white/10 bg-white/10 px-3 py-1 text-[0.65rem] font-medium uppercase tracking-[0.28em] text-white/70">
                            Preview
                          </span>
                        </div>
                        <div className="space-y-3">
                          <h3 className="text-xl font-display font-semibold tracking-tight text-white">
                            {game.title}
                          </h3>
                          <p className="max-w-xl text-sm leading-relaxed text-neutral-100/85 sm:text-base">
                            {game.tagline}
                          </p>
                        </div>
                        <div className="mt-auto space-y-3 text-sm text-neutral-200/90">
                          <span className="font-medium text-neutral-100">
                            {statusLabel}
                          </span>
                          <span className="inline-flex items-center gap-2 text-neutral-100/85">
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
                          {progressForGame && !progressForGame.completed ? (
                            <span className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/85">
                              ↺ Progress carries over when this mode launches
                            </span>
                          ) : null}
                          {showAvailabilityError ? (
                            <div className="flex flex-wrap items-center gap-3 pt-1">
                              <StatusChip
                                config={{
                                  tone: "warning",
                                  label: "Unable to load availability",
                                }}
                              />
                              <button
                                type="button"
                                onClick={handleAvailabilityRetry}
                                disabled={availabilityLoading}
                                className="inline-flex items-center gap-2 rounded-3xl border border-amber-300/60 bg-amber-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-100 transition hover:border-amber-200/70 hover:text-amber-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200/70"
                              >
                                Retry
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  </article>
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
