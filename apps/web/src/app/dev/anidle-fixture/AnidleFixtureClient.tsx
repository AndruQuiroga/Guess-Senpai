"use client";

import { useState } from "react";

import { AnidlePage } from "../../../components/puzzle-pages/AnidlePage";
import type {
  AnidleGuessEvaluation,
  AnidleGuessHistoryEntry,
  ScalarFeedback,
} from "../../../types/anidle";
import type { GameProgress } from "../../../types/progress";
import type { AnidleGame } from "../../../types/puzzles";

export type FixtureState = "empty" | "progress" | "solved" | "exhausted";

const puzzle: AnidleGame = {
  rules: { version: "2", max_attempts: 8, hint_after_incorrect: [2, 4, 6] },
  spec: [{ difficulty: 1, hints: ["year", "genres"] }],
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
        text: "A [REDACTED] with extraordinary [REDACTED] power tries to live an [REDACTED] life while [REDACTED] his emotions.",
      },
      {
        ratio: 0.5,
        text: "A student with extraordinary [REDACTED] power tries to live an ordinary life while [REDACTED] his emotions.",
      },
    ],
  },
};

function scalar(
  guess: number,
  target: number,
  season?: string,
): ScalarFeedback {
  return {
    guess,
    target,
    status: guess === target ? "match" : guess > target ? "higher" : "lower",
    guessSeason: season ?? null,
  };
}

function list(matched: string[], missed: string[]) {
  return [
    ...matched.map((value) => ({ value, status: "match" as const })),
    ...missed.map((value) => ({ value, status: "miss" as const })),
  ];
}

const EVALUATIONS: AnidleGuessEvaluation[] = [
  {
    title: "One-Punch Man",
    correct: false,
    year: scalar(2015, 2016, "fall"),
    averageScore: scalar(79, 84),
    popularity: scalar(480000, 214000),
    genres: list(["Action", "Comedy"], ["Sci-Fi"]),
    tags: list(["Psychic"], ["Super Power", "Parody", "Seinen", "Gag Humor"]),
    studios: list([], ["Madhouse"]),
    source: list([], ["Web Manga"]),
  },
  {
    title: "Fullmetal Alchemist: Brotherhood",
    correct: false,
    year: scalar(2009, 2016, "spring"),
    averageScore: scalar(91, 84),
    popularity: scalar(300000, 214000),
    genres: list([], ["Adventure", "Drama", "Fantasy"]),
    tags: list([], ["Military", "Alchemy", "War"]),
    studios: list([], ["Bones"]),
    source: list(["Manga"], []),
  },
  {
    title: "Kaguya-sama: Love is War",
    correct: false,
    year: scalar(2019, 2016, "spring"),
    averageScore: scalar(86, 84),
    popularity: scalar(190000, 214000),
    genres: list(["Comedy"], ["Romance"]),
    tags: list([], ["Love Triangle", "School"]),
    studios: list([], ["A-1 Pictures"]),
    source: list(["Manga"], []),
  },
  {
    title: "Mob Psycho 100",
    correct: true,
    year: scalar(2016, 2016, "summer"),
    averageScore: scalar(84, 84),
    popularity: scalar(214000, 214000),
    genres: list(["Action", "Comedy"], []),
    tags: list(["Psychic", "Coming of Age"], []),
    studios: list(["Bones"], []),
    source: list(["Web Manga"], []),
  },
];

function entry(index: number, id: number): AnidleGuessHistoryEntry {
  return {
    guess: EVALUATIONS[index].title,
    guessMediaId: id,
    evaluation: EVALUATIONS[index],
    evaluationVersion: 1,
  };
}

function progressFor(state: FixtureState): GameProgress | undefined {
  if (state === "empty") return undefined;
  const history: AnidleGuessHistoryEntry[] =
    state === "progress"
      ? [entry(0, 2104), entry(1, 5114), entry(2, 101921)]
      : state === "solved"
        ? [entry(0, 2104), entry(1, 5114), entry(3, 21507)]
        : Array.from({ length: 8 }, (_, i) => entry(i % 3, 3000 + i));
  return {
    completed: state === "solved",
    round: 1,
    guesses: history.map((item) => item.guess),
    anidleHistory: history,
    attemptLimit: 8,
  };
}

export default function AnidleFixtureClient({
  state,
}: {
  state: FixtureState;
}) {
  const [progress, setProgress] = useState<GameProgress | undefined>(() =>
    progressFor(state),
  );
  return (
    <div className="mx-auto max-w-5xl space-y-3">
      <p className="rounded-md border border-signal-deep bg-signal-soft px-3 py-2 text-sm font-semibold text-signal-text">
        LOCAL FIXTURE · NOT LIVE PUZZLE DATA ·
        ?state=empty|progress|solved|exhausted
      </p>
      <AnidlePage
        slug="anidle"
        mediaId={1}
        payload={puzzle}
        progress={progress}
        onProgressChange={setProgress}
        nextSlug="poster-zoomed"
      />
    </div>
  );
}
