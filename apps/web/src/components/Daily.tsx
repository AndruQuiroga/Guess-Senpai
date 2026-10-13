"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { GAMES_DIRECTORY } from "../config/games";
import {
  GameKey,
  PuzzleProgressProvider,
  usePuzzleProgress,
} from "../hooks/usePuzzleProgress";
import { useAccountStreak } from "../hooks/useAccount";
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
import { formatDurationFromMs, getMsUntilNextUtcMidnight } from "../utils/time";
import { projectStreakSnapshot } from "../utils/streak";
import { PanelSection } from "./PanelSection";
import SolutionReveal from "./SolutionReveal";
import StreakWidget from "./StreakWidget";
import NotificationOptInCard from "./NotificationOptInCard";
import { ShareCardRequestPayload, ShareComposer } from "./ShareComposer";
import { getGameOutcome } from "../utils/gameAction";
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
  gameKey: GameKey;
  status: GameProgressStatus;
  statusLabel: string;
  statusIcon: string;
  ctaLabel: string;
}

export default function Daily({ data }: Props) {
  if (!data) {
    return (
      <div className="relative flex min-h-[50vh] flex-col items-center justify-center gap-4 overflow-hidden rounded-lg border border-line bg-surface-raised p-6 text-center text-paper">
        <p className="max-w-md text-sm text-muted">
          Couldn&apos;t load today&apos;s puzzles. Your saved progress on this
          device is kept. Retry when the connection is available.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg border border-line-strong bg-panel-raised px-4 py-2 text-sm font-semibold text-paper hover:bg-panel-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <PuzzleProgressProvider
      date={data.date}
      puzzleId={data.puzzle_id}
      rulesVersion={data.rules_version}
    >
      <DailyContent data={data} />
    </PuzzleProgressProvider>
  );
}

function DailyContent({ data }: { data: DailyPuzzleResponse }) {
  const { progress, refresh, isRefreshing } = usePuzzleProgress(data.date);
  const formattedDate = useMemo(() => formatShareDate(data.date), [data.date]);
  const includeGuessTheOpening = data.guess_the_opening_enabled;
  const anidleBundle = data.games.anidle;
  const posterBundle = data.games.poster_zoomed;
  const silhouetteBundle = data.games.character_silhouette;
  const synopsisBundle = data.games.redacted_synopsis;
  const guessOpeningBundle = data.games.guess_the_opening ?? null;
  const posterProgress = progress.poster_zoomed ?? null;

  const bundleByKey = useMemo<GamePayloadRecord>(
    () => ({
      anidle: anidleBundle,
      poster_zoomed: posterBundle,
      character_silhouette: silhouetteBundle,
      redacted_synopsis: synopsisBundle,
      guess_the_opening:
        includeGuessTheOpening && guessOpeningBundle
          ? guessOpeningBundle
          : null,
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
    const posterRoundIds = (posterBundle?.puzzle.rounds ?? [])
      .map((round) => round?.mediaId)
      .filter(
        (value): value is number =>
          typeof value === "number" && Number.isFinite(value),
      );
    const ids = [
      anidleBundle?.mediaId ?? null,
      posterBundle?.mediaId ?? null,
      ...posterRoundIds,
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
      const exhausted = getGameOutcome(progressForGame) === "exhausted";
      const inProgress = Boolean(
        progressForGame &&
          !progressForGame.completed &&
          !exhausted &&
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
      } else if (exhausted) {
        status = "exhausted";
        statusLabel = "Out of guesses";
        statusIcon = "●";
      } else if (inProgress) {
        status = "in-progress";
        statusLabel = "In progress";
        statusIcon = "◐";
      }

      const ctaLabel = exhausted
        ? "Results"
        : completed
          ? "Replay"
          : inProgress
            ? "Resume"
            : "Play now";

      const timelineEntry = {
        slug: entry.slug,
        title: entry.title,
        description: entry.description,
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
      poster_zoomed: (
        <PosterZoomPreview bundle={posterBundle} progress={posterProgress} />
      ),
      character_silhouette: (
        <CharacterSilhouettePreview bundle={silhouetteBundle} />
      ),
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
      posterProgress,
    ],
  );

  const requiredGames: GameKey[] = timelineEntries.map(
    (entry) => entry.gameKey,
  );

  const { streak: accountStreak } = useAccountStreak();
  const allCompleted = requiredGames.every((key) => progress[key]?.completed);
  const streakInfo = useMemo(
    () => projectStreakSnapshot(accountStreak, data.date, allCompleted),
    [accountStreak, data.date, allCompleted],
  );
  const streakCount = streakInfo.count;

  const shareEvent = useMemo<ShareEventData>(() => {
    return {
      ...buildShareEvent(data.date, progress, {
        includeGuessTheOpening,
        aniListUrls: allCompleted ? solutionUrls : undefined,
      }),
      puzzleId: data.puzzle_id,
      rulesVersion: data.rules_version,
    };
  }, [
    allCompleted,
    data.date,
    data.puzzle_id,
    data.rules_version,
    includeGuessTheOpening,
    progress,
    solutionUrls,
  ]);

  const shareCardPayload = useMemo<ShareCardRequestPayload>(() => {
    const preferredTitle = primarySolution
      ? (primarySolution.titles.userPreferred ??
        primarySolution.titles.english ??
        primarySolution.titles.romaji ??
        primarySolution.titles.native ??
        null)
      : null;

    return {
      event: shareEvent,
      title: preferredTitle,
      streak: streakCount,
      cover: primarySolution?.coverImage ?? null,
    };
  }, [shareEvent, primarySolution, streakCount]);

  const shareLocked = useMemo(() => {
    return shareEvent.games.every((game) => game.status === "pending");
  }, [shareEvent]);

  const shareFileName = useMemo(
    () => `guesssenpai-${data.date}-share`,
    [data.date],
  );

  const syncButtonLabel = isRefreshing ? "Syncing…" : "Sync progress";

  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);
  const [hasRolledOver, setHasRolledOver] = useState(false);

  useEffect(() => {
    const checkRollover = () => {
      const todayUtc = new Date().toISOString().slice(0, 10);
      setHasRolledOver(data.date < todayUtc);
    };
    checkRollover();
    const interval = window.setInterval(checkRollover, 15_000);
    return () => window.clearInterval(interval);
  }, [data.date]);

  useEffect(() => {
    // Count to the next 00:00 UTC, never to the payload's reset_at: a value
    // without a timezone suffix is read as local time and can exceed 24h.
    const updateTimeRemaining = () => {
      setTimeRemaining(formatDurationFromMs(getMsUntilNextUtcMidnight()));
    };

    updateTimeRemaining();
    const intervalId = window.setInterval(updateTimeRemaining, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  const countdownDisplay = timeRemaining ?? "— — : — —";

  const [syncToast, setSyncToast] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

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
      <header className="relative overflow-hidden rounded-lg border border-line bg-surface-raised px-6 py-7 sm:px-8">
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="flex-1 space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-signal-text">
                Daily challenge
              </p>
              <h1 className="text-3xl font-display font-semibold tracking-tight text-paper drop- sm:text-[2.6rem]">
                GuessSenpai Daily
              </h1>
              <p className="text-sm text-muted">{formattedDate}</p>
              {hasRolledOver && (
                <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-signal bg-signal-soft p-3 text-sm text-paper">
                  <span>
                    A new UTC daily puzzle is available. This puzzle and its
                    progress are still here.
                  </span>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="font-semibold underline underline-offset-2"
                  >
                    Load new daily
                  </button>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2.5 text-sm">
              <span className="inline-flex items-center gap-2 rounded-full border border-close bg-panel-raised px-4 py-1.5 font-medium text-close-ink">
                🔥 Streak {streakCount}
              </span>
              {mediaIdLabel && (
                <span className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-panel-raised px-4 py-1.5 font-medium text-paper">
                  {mediaIdLabel}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-lg border border-line-strong bg-panel-raised px-5 py-2 text-sm font-semibold text-paper transition hover:bg-panel-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleSync}
                disabled={isRefreshing}
              >
                {syncButtonLabel}
              </button>
            </div>
          </div>
          <div className="flex w-full max-w-sm flex-none items-center justify-center self-stretch">
            <div className="relative w-full overflow-hidden rounded-lg border border-line bg-panel-raised px-6 py-6 text-center sm:px-7">
              <span className="text-xs font-semibold uppercase tracking-[0.4em] text-paper">
                Time left
              </span>
              <span className="mt-3 block font-mono text-4xl font-semibold leading-none text-paper sm:text-5xl">
                {countdownDisplay}
              </span>
              <span className="mt-3 block text-sm text-muted">
                Keep playing before the next drop lands.
              </span>
            </div>
          </div>
        </div>
      </header>

      {syncToast && (
        <div
          role="status"
          aria-live="polite"
          className={`inline-flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium sm:px-5 ${
            syncToast.tone === "success"
              ? "border-correct bg-correct-soft text-correct-ink"
              : "border-danger bg-danger-soft text-danger-ink"
          }`}
        >
          {syncToast.message}
        </div>
      )}

      <section className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)] lg:items-start">
        <div className="space-y-5 sm:space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-display font-semibold tracking-tight text-paper sm:text-2xl">
              Today&apos;s games
            </h2>
            <p className="text-sm leading-relaxed text-muted">
              Jump straight into each challenge—every puzzle is just a tap away.
            </p>
          </div>

          {timelineEntries.length > 0 ? (
            <div className="relative overflow-hidden rounded-lg border border-line bg-surface-raised p-5 sm:p-7">
              <div className="relative sm:pl-8">
                <span className="pointer-events-none absolute left-[0.35rem] top-6 bottom-6">
                  <span className="block h-full w-px bg-panel-raised" />
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
            <PanelSection dashed innerClassName="space-y-2 text-center">
              <p className="text-sm font-medium text-paper">
                No daily puzzles are available right now.
              </p>
              <p className="text-xs text-muted">
                Check back soon for fresh challenges.
              </p>
            </PanelSection>
          )}
        </div>

        <aside className="order-last lg:order-none">
          <PanelSection
            innerClassName="space-y-4 text-muted"
            className="h-full"
          >
            <div className="space-y-1">
              <h2 className="text-lg font-display font-semibold tracking-tight text-paper">
                Share your run
              </h2>
              <p className="text-sm text-muted">
                Craft a recap card with a single tap and show off your streak.
              </p>
            </div>
            <ShareComposer
              payload={shareCardPayload}
              shareLocked={shareLocked}
              fileName={shareFileName}
            />
          </PanelSection>
        </aside>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <StreakWidget
          currentDateIso={data.date}
          completed={allCompleted}
          streak={streakInfo}
          className="h-full"
        />
        <NotificationOptInCard />
      </div>

      {allCompleted && solutions.length > 0 && (
        <SolutionReveal solutions={solutions} streak={streakInfo} />
      )}
    </div>
  );
}
