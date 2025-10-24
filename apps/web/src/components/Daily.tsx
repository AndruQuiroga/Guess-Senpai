"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { GAMES_DIRECTORY } from "../config/games";
import { GameKey, usePuzzleProgress } from "../hooks/usePuzzleProgress";
import { useStreak } from "../hooks/useStreak";
import { DailyPuzzleResponse, GamesPayload } from "../types/puzzles";
import { buildShareText, formatShareDate } from "../utils/shareText";
import { GlassSection } from "./GlassSection";
import SolutionReveal from "./SolutionReveal";

interface Props {
  data: DailyPuzzleResponse | null;
}

type GamePayloadRecord = Partial<
  Record<GameKey, GamesPayload[keyof GamesPayload] | null>
>;

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

  const { progress } = usePuzzleProgress(data.date);
  const formattedDate = useMemo(() => formatShareDate(data.date), [data.date]);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [isGeneratingCard, setIsGeneratingCard] = useState(false);
  const [supportsFileShare, setSupportsFileShare] = useState(false);
  const includeGuessTheOpening = data.guess_the_opening_enabled;
  const guessOpeningPayload = data.games.guess_the_opening;

  const payloadByKey = useMemo<GamePayloadRecord>(
    () => ({
      anidle: data.games.anidle,
      poster_zoomed: data.games.poster_zoomed,
      redacted_synopsis: data.games.redacted_synopsis,
      guess_the_opening:
        includeGuessTheOpening && guessOpeningPayload
          ? guessOpeningPayload
          : null,
    }),
    [
      data.games.anidle,
      data.games.poster_zoomed,
      data.games.redacted_synopsis,
      guessOpeningPayload,
      includeGuessTheOpening,
    ],
  );

  const availableGames = useMemo(
    () =>
      GAMES_DIRECTORY.filter((entry) => {
        if (!entry.gameKey) {
          return false;
        }
        if (entry.gameKey === "guess_the_opening" && !includeGuessTheOpening) {
          return false;
        }
        return Boolean(payloadByKey[entry.gameKey]);
      }),
    [includeGuessTheOpening, payloadByKey],
  );

  const requiredGames: GameKey[] = availableGames
    .map((entry) => entry.gameKey)
    .filter((key): key is GameKey => Boolean(key));

  const allCompleted = requiredGames.every((key) => progress[key]?.completed);
  const streak = useStreak(data.date, allCompleted);

  const shareText = useMemo(() => {
    return buildShareText(data.date, progress, {
      includeGuessTheOpening,
      aniListUrl: allCompleted ? data.solution.aniListUrl : undefined,
    });
  }, [
    allCompleted,
    data.date,
    includeGuessTheOpening,
    data.solution.aniListUrl,
    progress,
  ]);

  const shareCardPayload = useMemo(() => {
    const preferredTitle =
      data.solution.titles.userPreferred ??
      data.solution.titles.english ??
      data.solution.titles.romaji ??
      data.solution.titles.native ??
      null;

    return {
      title: preferredTitle,
      date: data.date,
      streak,
      cover: data.solution.coverImage ?? null,
      includeGuessTheOpening,
      progress: {
        anidle: progress.anidle
          ? {
              completed: progress.anidle.completed,
              attempts: progress.anidle.guesses?.length ?? 0,
            }
          : null,
        poster_zoomed: progress.poster_zoomed
          ? {
              completed: progress.poster_zoomed.completed,
              round: progress.poster_zoomed.round,
            }
          : null,
        redacted_synopsis: progress.redacted_synopsis
          ? {
              completed: progress.redacted_synopsis.completed,
              round: progress.redacted_synopsis.round,
            }
          : null,
        guess_the_opening:
          includeGuessTheOpening && progress.guess_the_opening
            ? {
                completed: progress.guess_the_opening.completed,
                round: progress.guess_the_opening.round,
              }
            : null,
      },
    };
  }, [
    data.date,
    data.solution.coverImage,
    data.solution.titles.english,
    data.solution.titles.native,
    data.solution.titles.romaji,
    data.solution.titles.userPreferred,
    includeGuessTheOpening,
    progress.anidle,
    progress.guess_the_opening,
    progress.poster_zoomed,
    progress.redacted_synopsis,
    streak,
  ]);

  const shareButtonLabel = supportsFileShare
    ? "Share Progress"
    : "Download card";

  const handleShare = useCallback(async () => {
    try {
      setIsGeneratingCard(true);
      setShareStatus("Preparing share card…");

      const params = new URLSearchParams({
        data: JSON.stringify(shareCardPayload),
      });
      const response = await fetch(`/api/share-card?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Failed to generate share card: ${response.status}`);
      }

      const blob = await response.blob();
      const fileName = `guesssenpai-${data.date}-share.png`;

      if (supportsFileShare && navigator.share) {
        const file = new File([blob], fileName, {
          type: blob.type || "image/png",
        });
        const shareData: ShareData = {
          files: [file],
          text: shareText,
        };

        if (!navigator.canShare || navigator.canShare(shareData)) {
          await navigator.share(shareData);
          setShareStatus("Shared");
          return;
        }
      }

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      setShareStatus("Card downloaded");
    } catch (error) {
      console.warn("Share cancelled", error);
      setShareStatus("Unable to share card");
    } finally {
      setIsGeneratingCard(false);
    }
  }, [data.date, shareCardPayload, shareText, supportsFileShare]);

  useEffect(() => {
    if (!shareStatus) return;
    const timeout = window.setTimeout(() => setShareStatus(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [shareStatus]);

  useEffect(() => {
    if (typeof navigator === "undefined") {
      return;
    }
    if (!navigator.share) {
      setSupportsFileShare(false);
      return;
    }
    if (typeof navigator.canShare !== "function") {
      setSupportsFileShare(false);
      return;
    }
    try {
      const testFile = new File([""], "test.txt", { type: "text/plain" });
      setSupportsFileShare(navigator.canShare({ files: [testFile] }));
    } catch {
      setSupportsFileShare(false);
    }
  }, []);

  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-surface-raised p-6 shadow-ambient backdrop-blur-2xl">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-brand-400/60 to-transparent" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-display font-semibold tracking-tight text-white drop-shadow-[0_0_12px_rgba(59,130,246,0.35)]">
              GuessSenpai Daily
            </h1>
            <p className="text-sm text-neutral-300">{formattedDate}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-gradient-to-r from-amber-400/25 via-amber-500/10 to-amber-400/25 px-4 py-1.5 text-sm font-medium text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-sm">
              🔥 Streak {streak}
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-sm font-medium text-white/90 backdrop-blur-sm">
              Media #{data.mediaId}
            </div>
            <button
              type="button"
              className="rounded-2xl bg-gradient-to-r from-brand-500 via-purple-500 to-pink-500 px-5 py-2 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.01] hover:shadow-[0_0_25px_rgba(147,51,234,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleShare}
              disabled={isGeneratingCard}
            >
              {shareButtonLabel}
            </button>
          </div>
        </div>
        {shareStatus && (
          <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs text-white/90 shadow-inner transition">
            {shareStatus}
          </p>
        )}
      </header>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-display font-semibold tracking-tight text-white">
            Today&apos;s puzzles
          </h2>
          <p className="text-sm text-neutral-300/90">
            Work through each challenge below. You can play, pause, and resume
            puzzles individually from their dedicated pages.
          </p>
        </div>

        {availableGames.length > 0 ? (
          <div className="grid gap-5 lg:grid-cols-2">
            {availableGames.map((game) => {
              const key = game.gameKey;
              const progressForGame = key ? progress[key] : undefined;
              const completed = Boolean(progressForGame?.completed);
              const inProgress = Boolean(
                progressForGame &&
                  !progressForGame.completed &&
                  progressForGame.round > 0,
              );
              const statusLabel = completed
                ? "Completed"
                : inProgress
                  ? "In progress"
                  : "Not started";
              const statusTone = completed
                ? "text-emerald-200"
                : inProgress
                  ? "text-amber-200"
                  : "text-neutral-300";
              const ctaLabel = completed
                ? "Replay"
                : inProgress
                  ? "Resume"
                  : "Play now";

              return (
                <GlassSection
                  key={game.slug}
                  className="group relative overflow-hidden border-white/10 bg-surface-raised/80"
                  innerClassName="relative flex h-full flex-col gap-5"
                >
                  <div
                    aria-hidden
                    className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${game.accentColor} opacity-10 transition duration-500 group-hover:opacity-25`}
                  />

                  <div className="relative z-10 space-y-3">
                    <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.28em] text-neutral-300">
                      <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[0.6rem] text-neutral-200/90">
                        Daily puzzle
                      </span>
                      <span className={statusTone}>{statusLabel}</span>
                    </div>

                    <div className="space-y-2">
                      <h2 className="text-2xl font-display font-semibold tracking-tight text-white">
                        {game.title}
                      </h2>
                      {game.description ? (
                        <p className="text-sm leading-relaxed text-neutral-200/90">
                          {game.description}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="relative z-10 mt-auto flex flex-wrap items-center justify-between gap-3 pt-2 text-sm">
                    <div className="text-xs uppercase tracking-[0.3em] text-neutral-400">
                      {completed
                        ? "Great job!"
                        : inProgress
                          ? "Progress saved"
                          : "Ready when you are"}
                    </div>

                    <Link
                      href={`/games/${game.slug}`}
                      className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-brand-500 via-purple-500 to-pink-500 px-5 py-2 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.01] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
                    >
                      {ctaLabel}
                    </Link>
                  </div>
                </GlassSection>
              );
            })}
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

      {allCompleted && data.solution && (
        <SolutionReveal solution={data.solution} />
      )}
    </div>
  );
}
