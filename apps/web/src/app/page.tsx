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
  const gradientClasses =
    chunk.accent === "highlight"
      ? "from-brand-500/90 via-purple-500/80 to-amber-400/85"
      : "from-white/15 via-white/10 to-white/5";

  const wrapperClasses =
    layout === "inline"
      ? classNames(
          "inline-flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-gradient-to-br px-3 py-2 text-xs font-medium text-white/90 shadow-ambient sm:text-sm",
          `bg-gradient-to-br ${gradientClasses}`,
        )
      : classNames(
          "inline-flex w-full min-w-[10rem] flex-1 items-center gap-4 rounded-3xl border border-white/10 bg-gradient-to-br px-4 py-3 text-left text-sm text-white/95 shadow-ambient transition-transform duration-200 ease-out sm:w-auto sm:text-base",
          `bg-gradient-to-br ${gradientClasses}`,
        );

  const iconWrapperClasses = classNames(
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-base text-white",
    layout === "pill" && "h-10 w-10 text-lg",
  );

  const labelClasses = classNames(
    "truncate",
    layout === "pill" && "font-semibold",
    chunk.textClassName,
  );

  return (
    <span className={wrapperClasses}>
      <span aria-hidden className={iconWrapperClasses}>
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
        "flex flex-wrap items-start gap-3 text-sm text-white/90 sm:items-center sm:text-base",
        className,
      )}
    >
      {chunks.map((chunk) => (
        <ProgressSummaryChip key={chunk.id} chunk={chunk} layout={layout} />
      ))}
    </div>
  );
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
            <button
              type="button"
              disabled
              aria-disabled={true}
              className="group inline-flex items-center gap-3 rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 via-white/8 to-white/3 px-5 py-2.5 text-sm font-medium text-neutral-200/90 shadow-ambient transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
            >
              <span
                aria-hidden
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg text-white"
              >
                🔒
              </span>
              <span className="text-left">Play a round to unlock sharing.</span>
            </button>
          ) : (
            <button
              type="button"
              className="group relative inline-flex items-center gap-3 overflow-hidden rounded-3xl border border-brand-400/30 bg-gradient-to-br from-brand-500 via-purple-500 to-amber-400 px-6 py-3 text-sm font-semibold text-white shadow-[0_20px_45px_-25px_rgba(168,85,247,0.75)] transition-transform duration-200 ease-out hover:scale-[1.02] hover:shadow-[0_25px_55px_-25px_rgba(236,72,153,0.7)] active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
              onClick={handleShare}
            >
              <span
                aria-hidden
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-base text-white transition-colors duration-200 group-hover:bg-white/20"
              >
                <svg
                  aria-hidden
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7" />
                  <path d="M16 6l-4-4-4 4" />
                  <path d="M12 2v14" />
                </svg>
              </span>
              <span className="relative z-10">Share progress</span>
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
