"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { GameKey, usePuzzleProgress } from "../hooks/usePuzzleProgress";
import { useStreak } from "../hooks/useStreak";
import { DailyPuzzleResponse } from "../types/puzzles";
import Anidle from "./Anidle";
import { GameShell } from "./GameShell";
import GuessOpening from "./GuessOpening";
import PosterZoom from "./PosterZoom";
import SynopsisRedacted from "./SynopsisRedacted";

interface Props {
  data: DailyPuzzleResponse | null;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, day));
  return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export default function Daily({ data }: Props) {
  if (!data) {
    return (
      <div className="rounded-2xl bg-neutral-900 p-6 text-neutral-300">
        Couldn&apos;t load today&apos;s puzzles. Please refresh or try again later.
      </div>
    );
  }

  const { progress, recordGame } = usePuzzleProgress(data.date);
  const formattedDate = useMemo(() => formatDate(data.date), [data.date]);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  const anidleController = useRef<((round: number) => void) | null>(null);
  const posterController = useRef<((round: number) => void) | null>(null);
  const synopsisController = useRef<((round: number) => void) | null>(null);
  const openingController = useRef<((round: number) => void) | null>(null);

  const requiredGames: GameKey[] = ["anidle", "poster_zoomed", "redacted_synopsis"];
  if (data.games.guess_the_opening) {
    requiredGames.push("guess_the_opening");
  }

  const allCompleted = requiredGames.every((key) => progress[key]?.completed);
  const streak = useStreak(data.date, allCompleted);

  const shareText = useMemo(() => {
    const lines: string[] = [];
    lines.push(`GuessSenpai — ${formattedDate}`);

    const describe = (label: string, key: GameKey, totalRounds: number) => {
      const game = progress[key];
      if (!game) {
        return `${label} — ⏳`;
      }
      if (game.completed) {
        if (key === "anidle") {
          const attempts = Math.max(1, game.guesses.length);
          return `${label} — ${attempts} ${attempts === 1 ? "try" : "tries"} ✅`;
        }
        return `${label} — ✅ (${Math.min(totalRounds, game.round)}/${totalRounds})`;
      }
      return `${label} — ${Math.min(totalRounds, game.round)}/${totalRounds}`;
    };

    lines.push(describe("Anidle", "anidle", 3));
    lines.push(describe("Poster Zoomed", "poster_zoomed", 3));
    lines.push(describe("Redacted Synopsis", "redacted_synopsis", 3));
    if (data.games.guess_the_opening) {
      lines.push(describe("Guess the Opening", "guess_the_opening", 3));
    }
    lines.push("#GuessSenpai");
    return lines.join("\n");
  }, [data.games.guess_the_opening, formattedDate, progress]);

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

  return (
    <div className="space-y-8">
      <header className="rounded-3xl bg-neutral-900 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">GuessSenpai Daily</h1>
            <p className="text-sm text-neutral-400">{formattedDate}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-amber-400/30 bg-amber-500/15 px-4 py-2 text-sm text-amber-300 shadow-inner">
              🔥 Streak {streak}
            </div>
            <div className="rounded-2xl bg-blue-500/10 px-4 py-2 text-sm text-blue-200">
              Media #{data.mediaId}
            </div>
            <button
              type="button"
              className="rounded-2xl bg-gradient-to-r from-brand-500 via-purple-500 to-pink-500 px-5 py-2 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.01]"
              onClick={handleShare}
            >
              Share Progress
            </button>
          </div>
        </div>
        {shareStatus && (
          <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-1.5 text-xs text-neutral-200 shadow-inner transition">
            {shareStatus}
          </p>
        )}
      </header>

      <GameShell
        title="Anidle"
        round={progress.anidle?.round ?? 1}
        totalRounds={3}
        onJumpRound={(target) => anidleController.current?.(target)}
      >
        <Anidle
          payload={data.games.anidle}
          initialProgress={progress.anidle}
          onProgressChange={(state) => recordGame("anidle", state)}
          registerRoundController={(fn) => {
            anidleController.current = fn;
          }}
        />
      </GameShell>

      <GameShell
        title="Poster Zoomed"
        round={progress.poster_zoomed?.round ?? 1}
        totalRounds={3}
        onJumpRound={(target) => posterController.current?.(target)}
      >
        <PosterZoom
          payload={data.games.poster_zoomed}
          initialProgress={progress.poster_zoomed}
          onProgressChange={(state) => recordGame("poster_zoomed", state)}
          registerRoundController={(fn) => {
            posterController.current = fn;
          }}
        />
      </GameShell>

      <GameShell
        title="Redacted Synopsis"
        round={progress.redacted_synopsis?.round ?? 1}
        totalRounds={3}
        onJumpRound={(target) => synopsisController.current?.(target)}
      >
        <SynopsisRedacted
          payload={data.games.redacted_synopsis}
          initialProgress={progress.redacted_synopsis}
          onProgressChange={(state) => recordGame("redacted_synopsis", state)}
          registerRoundController={(fn) => {
            synopsisController.current = fn;
          }}
        />
      </GameShell>

      {data.games.guess_the_opening && (
        <GameShell
          title="Guess the Opening"
          round={progress.guess_the_opening?.round ?? 1}
          totalRounds={3}
          onJumpRound={(target) => openingController.current?.(target)}
        >
          <GuessOpening
            payload={data.games.guess_the_opening}
            initialProgress={progress.guess_the_opening}
            onProgressChange={(state) => recordGame("guess_the_opening", state)}
            registerRoundController={(fn) => {
              openingController.current = fn;
            }}
          />
        </GameShell>
      )}
    </div>
  );
}
