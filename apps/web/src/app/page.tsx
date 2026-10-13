"use client";

import Image from "next/image";
import Link from "next/link";

import { DailyRolloverNotice } from "../components/DailyRolloverNotice";
import { StatusMark } from "../components/nav/StatusMark";
import { useAccount, useAccountStreak } from "../hooks/useAccount";
import {
  useDailyAvailability,
  useRuntimeGamesDirectory,
} from "../hooks/useDailyAvailability";
import {
  PuzzleProgressProvider,
  usePuzzleProgress,
} from "../hooks/usePuzzleProgress";
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
        </p>
      </header>

      <ul
        aria-label="Daily puzzles"
        className="grid list-none gap-3 p-0 sm:grid-cols-2 sm:gap-4"
      >
        {games.map((game) => {
          const status = getGameStatus(
            game.gameKey ? progress[game.gameKey] : undefined,
          );
          const art =
            game.preview.media?.type === "image" ? game.preview.media : null;
          return (
            <li key={game.slug} className="flex">
              <Link
                href={`/games/${game.slug}`}
                className="panel group flex w-full flex-row items-center gap-4 p-3 no-underline transition hover:border-line-strong hover:bg-hover sm:flex-col sm:items-stretch sm:gap-3 sm:p-4"
              >
                {art ? (
                  <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-ink sm:h-36 sm:w-full">
                    <Image
                      src={art.src}
                      alt=""
                      width={144}
                      height={144}
                      className="h-full w-auto object-contain"
                    />
                  </span>
                ) : null}
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="font-display text-xl font-bold leading-tight text-paper">
                    {game.title}
                  </span>
                  <span className="text-base text-muted">{game.tagline}</span>
                  <StatusMark status={status} className="mt-1" />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

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
