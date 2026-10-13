"use client";

import { DailyRolloverNotice } from "../components/DailyRolloverNotice";
import Image from "next/image";
import Link from "next/link";
import { useDailyAvailability } from "../hooks/useDailyAvailability";

import { Panel, Status } from "../components/ui/Primitives";
import { useAccount, useAccountStreak } from "../hooks/useAccount";
import {
  PuzzleProgressProvider,
  usePuzzleProgress,
} from "../hooks/usePuzzleProgress";
import type { GameKey } from "../types/progress";
import {
  getGameAction,
  getGameOutcome,
  getGameStatusLabel,
} from "../utils/gameAction";

const featuredGames: {
  slug: string;
  key: GameKey;
  title: string;
  description: string;
  art: string;
}[] = [
  {
    slug: "anidle",
    key: "anidle",
    title: "Anidle",
    description:
      "Find the anime through metadata comparisons and synopsis clues.",
    art: "/games/anidle.svg",
  },
  {
    slug: "poster-zoomed",
    key: "poster_zoomed",
    title: "Poster",
    description: "Recognize the anime as more of its poster comes into view.",
    art: "/games/poster-zoomed.svg",
  },
];

export default function HomePage() {
  const { daily, error, refresh } = useDailyAvailability();
  if (!daily)
    return (
      <div className="today-page">
        <h1>Your daily anime puzzles.</h1>
        <p role="status">
          {error
            ? "Couldn't load today's progress and availability."
            : "Loading today's puzzles…"}
        </p>
        {error && (
          <button className="button" onClick={() => void refresh()}>
            Retry
          </button>
        )}
        <Link className="button button-primary" href="/games/anidle">
          Play Anidle →
        </Link>
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
  const { daily } = useDailyAvailability();
  const day = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
  const secondary = [
    {
      slug: "redacted-synopsis",
      title: "Redacted Synopsis",
      key: "redacted_synopsis" as GameKey,
    },
    {
      slug: "character-silhouette",
      title: "Character Silhouette",
      key: "character_silhouette" as GameKey,
    },
  ];
  if (daily?.available_modes.includes("guess_the_opening"))
    secondary.push({
      slug: "guess-the-opening",
      title: "Guess the Opening",
      key: "guess_the_opening",
    });

  return (
    <div className="today-page">
      <section className="today-intro">
        <div>
          <p className="eyebrow">TODAY · {day}</p>
          <h1>Your daily anime puzzles.</h1>
          <p className="today-subtitle">A little anime knowledge, every day.</p>
        </div>
        <div className="today-meta">
          <span>Daily reset · UTC</span>
          <strong>
            {streakError || accountError
              ? "Streak unavailable"
              : loading
                ? "Loading streak…"
                : !account.authenticated
                  ? "Play at your pace"
                  : streak.count === 0
                    ? "No active streak"
                    : `${streak.count} day streak`}
          </strong>
        </div>
      </section>

      <section aria-label="Featured daily puzzles" className="featured-puzzles">
        {featuredGames.map((game) => {
          const state = progress[game.key];
          const action = getGameAction(state);
          const outcome = getGameOutcome(state);
          const label =
            action === "resume"
              ? "Resume"
              : action === "results"
                ? "Results"
                : "Play";

          return (
            <article className="featured-card panel" key={game.key}>
              <div className="featured-art" aria-hidden="true">
                <Image src={game.art} alt="" width={92} height={112} />
              </div>
              <div className="featured-copy">
                <div className="card-heading">
                  <div>
                    <p className="eyebrow">DAILY PUZZLE</p>
                    <h2>{game.title}</h2>
                  </div>
                  <Status
                    aria-label={
                      outcome === "exhausted"
                        ? "Out of guesses"
                        : action === "results"
                          ? "Solved"
                          : action === "resume"
                            ? "In progress"
                            : "New"
                    }
                  >
                    {outcome === "exhausted"
                      ? "● Out of guesses"
                      : action === "results"
                        ? "✓ Solved"
                        : action === "resume"
                          ? "↻ In progress"
                          : "• New"}
                  </Status>
                </div>
                <p>{game.description}</p>
                <Link
                  className="button button-primary play-link"
                  href={`/games/${game.slug}`}
                >
                  {label}
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </article>
          );
        })}
      </section>

      <Panel className="more-puzzles">
        <div className="secondary-heading">
          <div>
            <p className="eyebrow">ALSO IN TODAY</p>
            <h2>More puzzles</h2>
          </div>
          <span>Pick another challenge</span>
        </div>
        <ul>
          {secondary.map((game) => {
            const action = getGameAction(progress[game.key]);
            const label =
              action === "results"
                ? "Results"
                : action === "resume"
                  ? "Resume"
                  : "Play";
            return (
              <li key={game.key}>
                <span>{game.title}</span>
                <span className="muted-status">
                  {getGameStatusLabel(progress[game.key])}
                </span>
                <Link
                  href={`/games/${game.slug}`}
                  aria-label={`${label} ${game.title}`}
                >
                  {label} →
                </Link>
              </li>
            );
          })}
        </ul>
      </Panel>

      {!loading && !accountError && !account.authenticated && (
        <p className="account-note">
          Playing as a guest. <Link href="/login">Sign in</Link> to sync
          progress across devices.
        </p>
      )}
      <p className="today-help">
        <Link href="/how-to-play">How to play</Link>
        <span> · </span>
        <Link href="/archive">Browse the archive</Link>
      </p>
    </div>
  );
}
