import { describe, expect, it } from "vitest";

import { computeDailyScore, formatDailyScore, scoreGame } from "../dailyScore";
import type { GameProgress } from "../../types/progress";

const anidle = (
  attempts: number,
  extra: Partial<GameProgress> = {},
): GameProgress =>
  ({
    completed: true,
    round: 1,
    guesses: [],
    anidleHistory: Array.from({ length: attempts }, () => ({})),
    attemptLimit: 8,
    ...extra,
  }) as GameProgress;

describe("scoreGame: Anidle", () => {
  it("rewards earlier solves", () => {
    expect(scoreGame("anidle", anidle(1))).toBe(3000);
    expect(scoreGame("anidle", anidle(4))).toBe(1875);
    expect(scoreGame("anidle", anidle(8))).toBe(375);
  });

  it("scores 0 for exhausted, in-progress and missing records", () => {
    expect(scoreGame("anidle", anidle(8, { completed: false }))).toBe(0);
    expect(scoreGame("anidle", anidle(3, { completed: false }))).toBe(0);
    expect(scoreGame("anidle", undefined)).toBe(0);
    expect(scoreGame("anidle", null)).toBe(0);
  });

  it("handles legacy records without attemptLimit or history", () => {
    const legacy = { completed: true, round: 1, guesses: ["a", "b"] };
    expect(scoreGame("anidle", legacy)).toBe(2625);
    expect(
      scoreGame("anidle", { completed: true, round: 1, guesses: [] }),
    ).toBe(3000);
  });

  it("clamps attempts beyond the limit and bad limits", () => {
    expect(scoreGame("anidle", anidle(20))).toBe(375);
    expect(scoreGame("anidle", anidle(2, { attemptLimit: 0 }))).toBe(2625);
    expect(scoreGame("anidle", anidle(2, { attemptLimit: Number.NaN }))).toBe(
      2625,
    );
  });
});

describe("scoreGame: round based modes", () => {
  const rounds = (...stages: number[]) =>
    stages.map((stage, index) => ({
      round: index + 1,
      guesses: Array.from({ length: stage }, () => "g"),
      stage,
      completed: true,
    }));

  it("gives full marks for first-stage solves", () => {
    const progress = {
      completed: true,
      round: 3,
      guesses: [],
      rounds: rounds(1, 1, 1),
    };
    expect(scoreGame("poster_zoomed", progress)).toBe(3000);
    expect(scoreGame("guess_the_opening", progress)).toBe(3000);
  });

  it("averages per-round efficiency and applies the floor", () => {
    const progress = {
      completed: true,
      round: 3,
      guesses: [],
      rounds: rounds(1, 2, 9),
    };
    // (1 + 0.75 + 0.25) / 3
    expect(scoreGame("poster_zoomed", progress)).toBe(2000);
  });

  it("scores 0 when the mode is not completed", () => {
    expect(
      scoreGame("poster_zoomed", {
        completed: false,
        round: 2,
        guesses: ["a"],
        rounds: rounds(1, 1),
      }),
    ).toBe(0);
  });

  it("uses wrong guesses beyond solved cards for legacy character records", () => {
    const clean = {
      completed: true,
      round: 3,
      guesses: [],
      rounds: [
        { round: 1, completed: true, stage: 4, guesses: ["1", "2", "3", "4"] },
      ],
    };
    const messy = {
      ...clean,
      rounds: [
        {
          round: 1,
          completed: true,
          stage: 4,
          guesses: ["1", "2", "3", "4", "5", "6"],
        },
      ],
    };
    expect(scoreGame("character_silhouette", clean)).toBe(3000);
    expect(scoreGame("character_silhouette", messy)).toBe(1500);
  });

  it("scores Redacted Synopsis by reveal round", () => {
    const base = { completed: true, guesses: ["a"] };
    expect(scoreGame("redacted_synopsis", { ...base, round: 1 })).toBe(3000);
    expect(scoreGame("redacted_synopsis", { ...base, round: 2 })).toBe(2250);
    expect(scoreGame("redacted_synopsis", { ...base, round: 3 })).toBe(1500);
  });

  it("handles legacy records with no rounds and falls back to guesses", () => {
    expect(
      scoreGame("poster_zoomed", {
        completed: true,
        round: 1,
        guesses: ["a", "b"],
      }),
    ).toBe(2250);
    expect(
      scoreGame("poster_zoomed", { completed: true, round: 1, guesses: [] }),
    ).toBe(3000);
  });

  it("tolerates malformed round entries", () => {
    const progress = {
      completed: true,
      round: 1,
      guesses: [],
      rounds: [null, {}, { stage: "x" }] as unknown as GameProgress["rounds"],
    };
    expect(scoreGame("poster_zoomed", progress)).toBe(3000);
  });
});

describe("computeDailyScore", () => {
  it("sums solved modes and sets max from today's modes", () => {
    const score = computeDailyScore(
      ["anidle", "poster_zoomed", "redacted_synopsis"],
      {
        anidle: anidle(1),
        redacted_synopsis: { completed: true, round: 2, guesses: ["a"] },
        poster_zoomed: { completed: false, round: 1, guesses: [] },
      },
    );
    expect(score.total).toBe(5250);
    expect(score.max).toBe(9000);
    expect(score.perGame.poster_zoomed).toBe(0);
    expect(formatDailyScore(score)).toBe("5,250 / 9,000");
  });

  it("reports 0 with a max while progress is unknown", () => {
    const score = computeDailyScore(
      ["anidle", "anidle", "guess_the_opening"],
      null,
    );
    expect(score).toMatchObject({ total: 0, max: 6000 });
  });

  it("is empty-safe", () => {
    expect(formatDailyScore(computeDailyScore([], {}))).toBe("0 / 0");
  });
});

describe("scoreGame: rounds v3", () => {
  it("adds the points each played round earned, finished or not", () => {
    const progress: GameProgress = {
      completed: false,
      round: 3,
      guesses: ["a", "b"],
      rounds: [
        { round: 1, guesses: ["a"], completed: true, points: 900 },
        { round: 2, guesses: ["b"], completed: true, points: 375 },
        { round: 3, guesses: [], completed: false, hints: 1 },
      ],
    };
    expect(scoreGame("poster_zoomed", progress)).toBe(1275);
    expect(scoreGame("character_silhouette", progress)).toBe(1275);
  });

  it("never exceeds the game maximum", () => {
    const progress: GameProgress = {
      completed: true,
      round: 3,
      guesses: [],
      rounds: [1, 2, 3, 4].map((round) => ({
        round,
        guesses: [],
        completed: true,
        points: 1000,
      })),
    };
    expect(scoreGame("redacted_synopsis", progress)).toBe(3000);
  });
});
