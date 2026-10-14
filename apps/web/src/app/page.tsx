"use client";

import Link from "next/link";

import { DailyRolloverNotice } from "../components/DailyRolloverNotice";
import { GameTile } from "../components/GameTile";
import { UNLIMITED_ANIDLE_HREF } from "../config/games";
import { useAccount, useAccountStreak } from "../hooks/useAccount";
import {
  useDailyAvailability,
  useRuntimeGamesDirectory,
} from "../hooks/useDailyAvailability";
import {
  PuzzleProgressProvider,
  usePuzzleProgress,
} from "../hooks/usePuzzleProgress";
import { computeDailyScore, formatDailyScore } from "../utils/dailyScore";
import { getGameStatus } from "../utils/gameAction";

export default function HomePage() {
  const { daily, error, refresh } = useDailyAvailability();
  if (!daily)
    return (
      <div className="space-y-4">
        <h1 className="font-display text-3xl font-bold tracking-tight text-paper">
          Today
        </h1>
        <p role="status" className="text-base text-muted">
          {error
            ? "Couldn't load today's progress and availability."
            : "Loading today's puzzles…"}
        </p>
        {error && (
          <div className="flex flex-wrap gap-3">
            <button className="button" onClick={() => void refresh()}>
              Retry
            </button>
            <Link className="button button-primary" href="/games/anidle">
              Play Anidle
            </Link>
          </div>
        )}
      </div>
    );
  const date = daily.date;
  return (
    <PuzzleProgressProvider
      date={date}
      puzzleId={daily.puzzle_id}
      rulesVersion={daily.rules_version}
    >
      <DailyRolloverNotice date={date} />
      <Today date={date} />
    </PuzzleProgressProvider>
  );
}

function Today({ date }: { date: string }) {
  const { daily } = useDailyAvailability();
  const { progress } = usePuzzleProgress(date);
  const { account, loading, error: accountError } = useAccount();
  const { streak, error: streakError } = useAccountStreak();
  const games = useRuntimeGamesDirectory();
  const day = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
  const score = computeDailyScore(
    games.flatMap((game) => (game.gameKey ? [game.gameKey] : [])),
    progress,
    daily?.round_max_points,
  );
  const streakText =
    streakError || accountError
      ? "Streak unavailable"
      : loading
        ? "Loading streak…"
        : !account.authenticated
          ? null
          : streak.count === 0
            ? "No active streak"
            : `${streak.count} day streak`;

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-bold tracking-tight text-paper">
          Today
        </h1>
        <p className="text-sm text-muted">
          {day} · Resets 00:00 UTC
          {streakText ? ` · ${streakText}` : ""}
          {score.max > 0 ? (
            <>
              {" · "}
              <Link
                href="/how-to-play#daily-score"
                className="whitespace-nowrap text-paper underline"
              >
                Today {formatDailyScore(score)}
              </Link>
            </>
          ) : null}
        </p>
      </header>

      <ul
        aria-label="Daily puzzles"
        className="grid list-none gap-3 p-0 sm:grid-cols-2"
      >
        {games.map((game) => (
          <li key={game.slug} className="flex">
            <GameTile
              game={game}
              status={getGameStatus(
                game.gameKey ? progress[game.gameKey] : undefined,
              )}
            />
          </li>
        ))}
      </ul>

      <p className="text-base text-muted">
        Want more?{" "}
        <Link
          href={UNLIMITED_ANIDLE_HREF}
          className="font-semibold text-paper underline"
        >
          Play Unlimited Anidle →
        </Link>
      </p>

      {!loading && !accountError && !account.authenticated && (
        <p className="text-sm text-muted">
          Playing as a guest.{" "}
          <Link href="/login" className="font-semibold text-paper underline">
            Sign in
          </Link>{" "}
          to sync progress across devices.
        </p>
      )}
    </div>
  );
}
