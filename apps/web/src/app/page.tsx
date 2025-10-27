"use client";

import Image from "next/image";
import Link from "next/link";
import {
  MouseEvent,
  SVGProps,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ArrowPathIcon,
  CheckBadgeIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  LockClosedIcon,
} from "@heroicons/react/24/solid";

import { DailyCompletionBanner } from "../components/DailyCompletionBanner";
import { GamePreviewModal } from "../components/GamePreviewModal";
import { DailyRestNotice } from "../components/DailyRestNotice";
import {
  HomeHero,
  type HeroCta,
  type ProgressSummaryChunk,
} from "../components/HomeHero";
import { ShareRecapCard } from "../components/ShareRecapCard";
import { UpcomingTimeline } from "../components/UpcomingTimeline";
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

type StatusToneStyle = {
  Icon: (props: SVGProps<SVGSVGElement>) => JSX.Element;
  className: string;
  iconClassName: string;
};

const STATUS_TONE_STYLES: Record<StatusTone, StatusToneStyle> = {
  resume: {
    Icon: ArrowPathIcon,
    className: "border-emerald-500/50 bg-emerald-600/25 text-emerald-50",
    iconClassName: "text-emerald-200",
  },
  available: {
    Icon: CheckBadgeIcon,
    className: "border-brand-500/50 bg-brand-600/25 text-brand-50",
    iconClassName: "text-brand-200",
  },
  comingSoon: {
    Icon: ClockIcon,
    className: "border-sky-500/45 bg-sky-600/25 text-sky-50",
    iconClassName: "text-sky-200",
  },
  locked: {
    Icon: LockClosedIcon,
    className: "border-slate-500/45 bg-slate-600/25 text-slate-100",
    iconClassName: "text-slate-200",
  },
  warning: {
    Icon: ExclamationTriangleIcon,
    className: "border-amber-500/60 bg-amber-600/25 text-amber-50",
    iconClassName: "text-amber-200",
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
        "inline-flex items-center gap-2 rounded-2xl border px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] transition",
        toneStyles.className,
        className,
      )}
    >
      <toneStyles.Icon
        aria-hidden
        className={classNames("h-4 w-4", toneStyles.iconClassName)}
      />
      <span className="leading-none">{config.label}</span>
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

type GameTileProps = {
  game: GameDirectoryEntry;
  statusChip: StatusChipConfig;
  statusLabel: string;
  onPreview: () => void;
  overlayClasses: string;
  showProgressReminder: boolean;
  showAvailabilityError: boolean;
  onAvailabilityRetry: () => void;
  availabilityLoading: boolean;
};

function GameTile({
  game,
  statusChip,
  statusLabel,
  onPreview,
  overlayClasses,
  showProgressReminder,
  showAvailabilityError,
  onAvailabilityRetry,
  availabilityLoading,
}: GameTileProps): JSX.Element {
  return (
    <article
      className="relative flex w-[min(85vw,18.5rem)] flex-shrink-0 snap-start"
      data-game-tile
      role="listitem"
    >
      <div
        role="button"
        tabIndex={0}
        aria-label={`${game.title} preview`}
        onClick={onPreview}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onPreview();
          }
        }}
        className="group relative flex h-64 w-full cursor-pointer flex-col overflow-hidden rounded-3xl border border-white/12 bg-surface-raised/70 p-5 text-white shadow-ambient backdrop-blur-2xl transition hover:border-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/65"
      >
        {renderPreviewBackground(
          game.preview.media,
          game.accentColor,
          overlayClasses,
        )}
        <div className="relative z-10 flex h-full flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <StatusChip
              config={statusChip}
              className="text-[0.55rem] text-white/90"
            />
            <span className="inline-flex items-center gap-1 rounded-2xl border border-white/12 bg-white/10 px-2 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.3em] text-white/70">
              Preview
            </span>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-display font-semibold tracking-tight">
              {game.title}
            </h3>
            <p className="text-sm leading-snug text-neutral-100/85">
              {statusLabel}
            </p>
          </div>
          <div className="mt-auto flex flex-col gap-2 text-[0.7rem] text-neutral-200/90">
            {showProgressReminder ? (
              <span className="inline-flex items-center gap-2 text-neutral-100/85">
                <span aria-hidden>↺</span>
                Progress saved for launch
              </span>
            ) : null}
            {showAvailabilityError ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[0.6rem] font-semibold uppercase tracking-[0.22em] text-amber-100">
                  Status unavailable
                </span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onAvailabilityRetry();
                  }}
                  disabled={availabilityLoading}
                  className="inline-flex items-center gap-2 rounded-3xl border border-amber-300/60 bg-amber-400/10 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.22em] text-amber-50 transition hover:border-amber-200/70 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200/70"
                >
                  Retry
                </button>
              </div>
            ) : null}
            <div className="flex items-center justify-between pt-1 text-sm">
              <span className="text-neutral-100/80">Ready when you are</span>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onPreview();
                }}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white transition hover:border-white/40 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/65"
              >
                Start
                <svg
                  aria-hidden
                  className="h-3.5 w-3.5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M7.293 4.707a1 1 0 011.414-1.414l5.586 5.586a1 1 0 010 1.414l-5.586 5.586a1 1 0 01-1.414-1.414L11.172 10 7.293 6.121a1 1 0 010-1.414z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
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

  const primaryCta: HeroCta | undefined = allCompleted
    ? { href: "/archive", label: "Dive into the archive" }
    : hasIncompleteGame && nextIncompleteGame
      ? {
          href: `/games/${nextIncompleteGame.slug}`,
          label: `Resume ${nextIncompleteGame.title}`,
        }
      : { href: "/games/daily", label: "Play today’s lineup" };

  const secondaryCta: HeroCta | undefined =
    !allCompleted && hasIncompleteGame
      ? { href: "/games/daily", label: "Continue" }
      : undefined;

  return (
    <>
      <main className="mx-auto min-h-screen max-w-6xl px-6 py-12 lg:px-12 xl:px-16">
        <div className="flex min-h-full flex-col gap-12 lg:grid lg:grid-rows-[minmax(360px,auto)_minmax(0,1fr)_auto] lg:gap-12">
          <section className="flex flex-col justify-center gap-10">
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
          </section>

          <section className="flex min-h-0 flex-col gap-10 lg:min-h-0">
            <div className="flex-shrink-0">
              <UpcomingTimeline
                games={upcomingGames}
                unlockLabels={upcomingUnlockLabels}
                onPreview={handleOpenPreview}
                statusUnavailable={showAvailabilityError}
                onRetry={handleAvailabilityRetry}
                availabilityLoading={availabilityLoading}
              />
            </div>

            <section className="flex min-h-0 flex-col gap-6 overflow-hidden lg:min-h-0">
              <div className="flex-shrink-0 space-y-2">
                <h2 className="text-2xl font-display font-semibold tracking-tight text-white">
                  Choose your game
                </h2>
                <p className="text-sm text-neutral-300">
                  Jump into today&apos;s lineup or preview what&apos;s coming
                  next.
                </p>
              </div>
              {playableGames.length > 0 ? (
                <div className="flex min-h-0 flex-col gap-5 lg:overflow-y-auto lg:pr-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
                    <h3 className="text-lg font-semibold text-white">
                      Available today
                    </h3>
                    <p className="text-sm text-neutral-300/90">
                      Modern cards highlight what you can play now—tap in or
                      preview the run.
                    </p>
                  </div>
                  <div className="grid flex-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
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
                                <p className="text-neutral-100/85">
                                  {secondaryInfo}
                                </p>
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
              ) : (
                <DailyRestNotice />
              )}
            </section>
          </section>

          <footer className="flex flex-col justify-end gap-6 pb-6">
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
          </footer>
        </div>
      </main>

      <GamePreviewModal
        open={Boolean(previewGame)}
        game={previewGame}
        onClose={handleClosePreview}
        progress={
          previewGame?.gameKey ? progress[previewGame.gameKey] : undefined
        }
      />
    </>
  );
}
