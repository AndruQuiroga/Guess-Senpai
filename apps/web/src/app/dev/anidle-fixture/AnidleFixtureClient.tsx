"use client";

import Anidle from "../../../components/Anidle";
import { GameShell } from "../../../components/GameShell";
import GameSwitcher from "../../../components/GameSwitcher";
import type { DailyProgress, GameProgress } from "../../../types/progress";
import type { AnidleGame } from "../../../types/puzzles";

const puzzle: AnidleGame = {
  spec: [
    { difficulty: 1, hints: ["year", "genres"] },
    { difficulty: 2, hints: ["episodes", "tags"] },
    { difficulty: 3, hints: ["average_score", "popularity"] },
  ],
  answer: "Mob Psycho 100",
  hints: {
    genres: ["Action", "Comedy"],
    tags: ["Psychic", "Coming of Age"],
    year: 2016,
    episodes: 12,
    duration: 24,
    popularity: 214000,
    average_score: 84,
    synopsis: [
      {
        ratio: 0.2,
        text: "A student with extraordinary psychic power tries to live an ordinary life.",
      },
    ],
  },
};

function evaluation(
  title: string,
  correct: boolean,
  year: number,
  yearStatus: "higher" | "lower" | "match",
) {
  return {
    title,
    correct,
    year: { guess: year, target: 2016, status: yearStatus },
    averageScore: { guess: 79, target: 84, status: "lower" as const },
    popularity: { guess: 180000, target: 214000, status: "lower" as const },
    genres: [
      { value: "Action", status: "match" as const },
      { value: "Drama", status: "miss" as const },
    ],
    tags: [{ value: "Psychic", status: "match" as const }],
    studios: [{ value: "Bones", status: "match" as const }],
    source: [{ value: "Manga", status: "match" as const }],
  };
}

export default function AnidleFixtureClient({ solved }: { solved: boolean }) {
  const initialProgress: GameProgress | undefined = solved
    ? {
        completed: true,
        round: 2,
        guesses: ["One Punch Man", "Mob Psycho 100"],
        anidleHistory: [
          {
            guess: "One Punch Man",
            guessMediaId: 2104,
            evaluation: evaluation("One-Punch Man", false, 2015, "lower"),
            evaluationVersion: 1,
          },
          {
            guess: "Mob Psycho 100",
            guessMediaId: 21507,
            evaluation: evaluation("Mob Psycho 100", true, 2016, "match"),
            evaluationVersion: 1,
          },
        ],
      }
    : undefined;

  return (
    <div className="mx-auto max-w-4xl space-y-3">
      <p className="rounded-md border border-signal-deep bg-signal-soft px-3 py-2 text-sm font-semibold text-signal-text">
        LOCAL FIXTURE · NOT LIVE PUZZLE DATA
      </p>
      <GameShell
        title="Anidle"
        round={solved ? 2 : 1}
        totalRounds={3}
        roundLabel="Round"
        actions={
          <GameSwitcher
            currentSlug="anidle"
            progress={
              initialProgress
                ? ({ anidle: initialProgress } as DailyProgress)
                : undefined
            }
          />
        }
      >
        <Anidle
          mediaId={1}
          payload={puzzle}
          initialProgress={initialProgress}
          onProgressChange={() => undefined}
          nextSlug="poster-zoomed"
        />
      </GameShell>
    </div>
  );
}
