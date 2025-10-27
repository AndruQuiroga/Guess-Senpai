"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { GAMES_DIRECTORY } from "../config/games";
import { GameKey, usePuzzleProgress } from "../hooks/usePuzzleProgress";
import { useStreak } from "../hooks/useStreak";
import {
  DailyPuzzleResponse,
  GamesPayload,
  SolutionPayload,
} from "../types/puzzles";
import {
  buildShareEvent,
  formatShareDate,
  type ShareEventData,
} from "../utils/shareText";
import { formatDurationFromMs, getNextResetIso } from "../utils/time";
import { GlassSection } from "./GlassSection";
import SolutionReveal from "./SolutionReveal";
import StreakWidget from "./StreakWidget";
import NotificationOptInCard from "./NotificationOptInCard";
import {
  ShareCardRequestPayload,
  ShareComposer,
} from "./ShareComposer";
import {
  AnidlePreview,
  CharacterSilhouettePreview,
  GamePreviewCard,
  GuessOpeningPreview,
  PosterZoomPreview,
  RedactedSynopsisPreview,
  type GameProgressStatus,
} from "./games";

interface Props {
  data: DailyPuzzleResponse | null;
}

type GamePayloadRecord = Partial<
  Record<GameKey, GamesPayload[keyof GamesPayload] | null>
>;

interface TimelineEntry {
  slug: string;
  title: string;
  description?: string;
  accentColor: string;
  gameKey: GameKey;
  status: GameProgressStatus;
  statusLabel: string;
  statusIcon: string;
  ctaLabel: string;
}

export default function Daily({ data }: Props) {
  if (!data) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-surface-raised p-6 text-neutral-100 shadow-ambient backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />
        Couldn&apos;t load today&apos;s puzzles. Please refresh or try again
        later.
      </div>
    );
  }

  const { progress, refresh, isRefreshing } = usePuzzleProgress(data.date);
  const formattedDate = useMemo(() => formatShareDate(data.date), [data.date]);
  const nextResetIso = useMemo(() => getNextResetIso(data.date), [data.date]);
  const includeGuessTheOpening = data.guess_the_opening_enabled;
  const anidleBundle = data.games.anidle;
  const posterBundle = data.games.poster_zoomed;
  const silhouetteBundle = data.games.character_silhouette;
  const synopsisBundle = data.games.redacted_synopsis;
  const guessOpeningBundle = data.games.guess_the_opening ?? null;

  const bundleByKey = useMemo<GamePayloadRecord>(
    () => ({
      anidle: anidleBundle,
      poster_zoomed: posterBundle,
      character_silhouette: silhouetteBundle,
      redacted_synopsis: synopsisBundle,
      guess_the_opening:
        includeGuessTheOpening && guessOpeningBundle ? guessOpeningBundle : null,
    }),
    [
      anidleBundle,
      posterBundle,
      silhouetteBundle,
      synopsisBundle,
      guessOpeningBundle,
      includeGuessTheOpening,
    ],
  );

  const solutions = useMemo<SolutionPayload[]>(() => {
    const entries: SolutionPayload[] = [];
    const seen = new Set<string>();
    const append = (solution: SolutionPayload | null | undefined) => {
      if (!solution) return;
      const key = solution.aniListUrl ?? "";
      if (seen.has(key)) return;
      seen.add(key);
      entries.push(solution);
    };
    append(anidleBundle?.solution ?? null);
    append(posterBundle?.solution ?? null);
    append(silhouetteBundle?.solution ?? null);
    append(synopsisBundle?.solution ?? null);
    if (includeGuessTheOpening) {
      append(guessOpeningBundle?.solution ?? null);
    }
    return entries;
  }, [
    anidleBundle,
    posterBundle,
    silhouetteBundle,
    synopsisBundle,
    includeGuessTheOpening,
    guessOpeningBundle,
  ]);

  const solutionUrls = useMemo(
    () => solutions.map((solution) => solution.aniListUrl),
    [solutions],
  );

  const primarySolution = useMemo<SolutionPayload | null>(() => {
    if (anidleBundle) return anidleBundle.solution;
    if (silhouetteBundle) return silhouetteBundle.solution;
    if (posterBundle) return posterBundle.solution;
    if (synopsisBundle) return synopsisBundle.solution;
    if (includeGuessTheOpening && guessOpeningBundle) {
      return guessOpeningBundle.solution;
    }
    return null;
  }, [
    anidleBundle,
    posterBundle,
    synopsisBundle,
    includeGuessTheOpening,
    guessOpeningBundle,
  ]);

  const mediaIdLabel = useMemo(() => {
    const ids = [
      anidleBundle?.mediaId ?? null,
      posterBundle?.mediaId ?? null,
      silhouetteBundle?.mediaId ?? null,
      synopsisBundle?.mediaId ?? null,
      includeGuessTheOpening && guessOpeningBundle
        ? guessOpeningBundle.mediaId
        : null,
    ].filter((value): value is number => typeof value === "number");
    if (ids.length === 0) {
      return null;
    }
    const uniqueIds = Array.from(new Set(ids));
    if (uniqueIds.length === 1) {
      return `Media #${uniqueIds[0]}`;
    }
    return `Media IDs: ${uniqueIds.map((id) => `#${id}`).join(" · ")}`;
  }, [
    anidleBundle,
    posterBundle,
    silhouetteBundle,
    synopsisBundle,
    includeGuessTheOpening,
    guessOpeningBundle,
  ]);

  const availableGames = useMemo(
    () =>
      GAMES_DIRECTORY.filter((entry) => {
        if (!entry.gameKey) {
          return false;
        }
        if (entry.gameKey === "guess_the_opening" && !includeGuessTheOpening) {
          return false;
        }
        return Boolean(bundleByKey[entry.gameKey]);
      }),
    [includeGuessTheOpening, bundleByKey],
  );

  const timelineEntries = useMemo<TimelineEntry[]>(() => {
    return availableGames.flatMap((entry) => {
      if (!entry.gameKey || !entry.slug) {
        return [];
      }

      const progressForGame = progress[entry.gameKey];
      const completed = Boolean(progressForGame?.completed);
      const inProgress = Boolean(
        progressForGame &&
          !progressForGame.completed &&
          ((progressForGame.round ?? 0) > 0 ||
            (progressForGame.guesses?.length ?? 0) > 0),
      );

      let status: GameProgressStatus = "not-started";
      let statusLabel = "Not started";
      let statusIcon = "•";

      if (completed) {
        status = "completed";
        statusLabel = "Completed";
        statusIcon = "✓";
      } else if (inProgress) {
        status = "in-progress";
        statusLabel = "In progress";
        statusIcon = "◐";
      }

      const ctaLabel = completed ? "Replay" : inProgress ? "Resume" : "Play now";

      const timelineEntry = {
        slug: entry.slug,
        title: entry.title,
        description: entry.description,
        accentColor: entry.accentColor,
        gameKey: entry.gameKey,
        status,
        statusLabel,
        statusIcon,
        ctaLabel,
      } satisfies TimelineEntry;

      return [timelineEntry];
    });
  }, [availableGames, progress]);

  const previewComponents = useMemo<Partial<Record<GameKey, ReactNode>>>(
    () => ({
      anidle: <AnidlePreview bundle={anidleBundle} />,
      poster_zoomed: <PosterZoomPreview bundle={posterBundle} />,
      character_silhouette: <CharacterSilhouettePreview bundle={silhouetteBundle} />,
      redacted_synopsis: <RedactedSynopsisPreview bundle={synopsisBundle} />,
      guess_the_opening:
        includeGuessTheOpening && guessOpeningBundle ? (
          <GuessOpeningPreview bundle={guessOpeningBundle} />
        ) : null,
    }),
    [
      anidleBundle,
      posterBundle,
      silhouetteBundle,
      synopsisBundle,
      includeGuessTheOpening,
      guessOpeningBundle,
    ],
  );

  const requiredGames: GameKey[] = timelineEntries.map((entry) => entry.gameKey);

  const allCompleted = requiredGames.every((key) => progress[key]?.completed);
  const streakInfo = useStreak(data.date, allCompleted);
  const streakCount = streakInfo.count;

  const shareEvent = useMemo<ShareEventData>(() => {
    return buildShareEvent(data.date, progress, {
      includeGuessTheOpening,
      aniListUrls: allCompleted ? solutionUrls : undefined,
    });
  }, [
    allCompleted,
    data.date,
    includeGuessTheOpening,
    progress,
    solutionUrls,
  ]);

  const shareCardPayload = useMemo<ShareCardRequestPayload>(() => {
    const preferredTitle = primarySolution
      ? primarySolution.titles.userPreferred ??
        primarySolution.titles.english ??
        primarySolution.titles.romaji ??
        primarySolution.titles.native ??
        null
      : null;

    return {
      event: shareEvent,
      title: preferredTitle,
      streak: streakCount,
      cover: primarySolution?.coverImage ?? null,
    };
  }, [
    shareEvent,
    primarySolution,
    streakCount,
  ]);

  const shareLocked = useMemo(() => {
    return shareEvent.games.every((game) => game.status === "pending");
  }, [shareEvent]);

  const shareFileName = useMemo(
    () => `guesssenpai-${data.date}-share`,
    [data.date],
  );

  const syncButtonLabel = isRefreshing ? "Syncing…" : "Sync progress";

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

  const [syncToast, setSyncToast] = useState<
    | {
        tone: "success" | "error";
        message: string;
      }
    | null
  >(null);

  const handleSync = useCallback(async () => {
    const result = await refresh();
    if (result.success) {
      setSyncToast({ tone: "success", message: "Progress synced" });
      return;
    }
    const errorMessage =
      result.error?.status === 401
        ? "Sign in to sync progress"
        : result.error?.message?.trim() || "Failed to sync progress";
    setSyncToast({ tone: "error", message: errorMessage });
  }, [refresh]);

  useEffect(() => {
    if (!syncToast) return;
    const timeout = window.setTimeout(() => setSyncToast(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [syncToast]);

  return (
    <div className="space-y-6 sm:space-y-8">
      <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-surface-raised p-6 shadow-ambient backdrop-blur-2xl sm:p-7">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-brand-400/60 to-transparent" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-display font-semibold tracking-tight text-white drop-shadow-[0_0_12px_rgba(59,130,246,0.35)]">
              GuessSenpai Daily
            </h1>
            <p className="text-sm text-neutral-300">{formattedDate}</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:auto-cols-max sm:grid-flow-col sm:items-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-gradient-to-r from-amber-400/25 via-amber-500/10 to-amber-400/25 px-4 py-1.5 text-sm font-medium text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-sm">
              🔥 Streak {streakCount}
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-sm font-medium text-white/90 backdrop-blur-sm">
              {timeRemaining ? `⏱️ Resets in ${timeRemaining}` : "⏱️ Resets soon"}
            </div>
            {mediaIdLabel && (
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-sm font-medium text-white/90 backdrop-blur-sm">
                {mediaIdLabel}
              </div>
            )}
            <button
              type="button"
              className="rounded-2xl border border-white/15 bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleSync}
              disabled={isRefreshing}
            >
              {syncButtonLabel}
            </button>
          </div>
        </div>
      </header>

      <GlassSection innerClassName="space-y-4 text-neutral-200">
        <div className="space-y-1">
          <h2 className="text-lg font-display font-semibold tracking-tight text-white">
            Share your run
          </h2>
          <p className="text-sm text-neutral-300/90">
            Choose a theme, generate a recap card, and spread the word with a single tap.
          </p>
        </div>
        <ShareComposer
          payload={shareCardPayload}
          shareLocked={shareLocked}
          fileName={shareFileName}
        />
      </GlassSection>

      <StreakWidget currentDateIso={data.date} completed={allCompleted} />

      <NotificationOptInCard />

      {syncToast && (
        <div
          role="status"
          aria-live="polite"
          className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium shadow-glow backdrop-blur sm:px-5 ${
            syncToast.tone === "success"
              ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-100"
              : "border-rose-400/40 bg-rose-500/20 text-rose-100"
          }`}
        >
          {syncToast.message}
        </div>
      )}

      <section className="space-y-5 sm:space-y-6">
        <div className="space-y-1">
          <h2 className="text-xl font-display font-semibold tracking-tight text-white sm:text-2xl">
            Today&apos;s puzzles
          </h2>
          <p className="text-sm leading-relaxed text-neutral-300/90">
            Follow the timeline to preview your first hints and jump straight into each challenge.
          </p>
        </div>

        {timelineEntries.length > 0 ? (
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-surface-raised/80 p-5 shadow-ambient backdrop-blur-2xl sm:p-7">
            <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-brand-400/60 to-transparent sm:inset-x-9" />
            <div className="relative sm:pl-8">
              <span className="pointer-events-none absolute left-[0.35rem] top-6 bottom-6">
                <span className="block h-full w-px bg-white/15" />
              </span>
              <ol className="space-y-6 sm:space-y-8">
                {timelineEntries.map((entry, index) => (
                  <GamePreviewCard
                    key={entry.slug}
                    slug={entry.slug}
                    title={entry.title}
                    description={entry.description}
                    status={entry.status}
                    statusLabel={entry.statusLabel}
                    statusIcon={entry.statusIcon}
                    accentColor={entry.accentColor}
                    ctaLabel={entry.ctaLabel}
                    href={`/games/${entry.slug}`}
                    index={index}
                    preview={previewComponents[entry.gameKey] ?? null}
                  />
                ))}
              </ol>
            </div>
          </div>
        ) : (
          <GlassSection
            className="border-dashed border-white/10 bg-surface-raised/50"
            innerClassName="space-y-2 text-center"
          >
            <p className="text-sm font-medium text-white/90">
              No daily puzzles are available right now.
            </p>
            <p className="text-xs text-neutral-300/80">
              Check back soon for fresh challenges.
            </p>
          </GlassSection>
        )}
      </section>

      {allCompleted && solutions.length > 0 && (
        <SolutionReveal solutions={solutions} streak={streakInfo} />
      )}
    </div>
  );
}
