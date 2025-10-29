import { act, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import Anidle from "../Anidle";
import type { AnidleGame } from "../../types/puzzles";
import type { GameProgress } from "../../hooks/usePuzzleProgress";
import {
  CURRENT_ANIDLE_EVALUATION_VERSION,
  type AnidleGuessEvaluation,
} from "../../types/anidle";

const evaluateAnidleGuessMock = vi.hoisted(() =>
  vi.fn(async ({ guess }: { guess: string }) => {
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
    return {
      title: guess,
      correct: false,
      year: { guess: null, target: null, status: "unknown" },
      averageScore: { guess: null, target: null, status: "unknown" },
      popularity: { guess: null, target: null, status: "unknown" },
      genres: [],
      tags: [],
      studios: [],
      source: [],
    } satisfies AnidleGuessEvaluation;
  }),
);

vi.mock("../../utils/evaluateAnidleGuess", () => ({
  evaluateAnidleGuess: (
    payload: Parameters<typeof evaluateAnidleGuessMock>[0],
  ) => evaluateAnidleGuessMock(payload),
}));

describe("Anidle hydration", () => {
  const payload: AnidleGame = {
    spec: [
      { difficulty: 1, hints: ["genres"] },
      { difficulty: 2, hints: ["tags"] },
      { difficulty: 3, hints: ["year"] },
    ],
    answer: "Correct Title",
    hints: {
      genres: [],
      tags: [],
      synopsis: [],
    },
  }; 

  beforeEach(() => {
    evaluateAnidleGuessMock.mockClear();

    const raf = vi.fn<(cb: FrameRequestCallback) => number>((cb) => {
      const id = window.setTimeout(() => cb(performance.now()), 16);
      return id;
    });
    const caf = vi.fn((id: number) => window.clearTimeout(id));
    vi.stubGlobal("requestAnimationFrame", raf);
    vi.stubGlobal("cancelAnimationFrame", caf);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("hydrates more than twenty guesses without blocking the UI", async () => {
    const guesses = Array.from(
      { length: 25 },
      (_, index) => `Guess ${index + 1}`,
    );
    const initialProgress: GameProgress = {
      completed: false,
      round: 1,
      guesses,
    };

    const onProgressChange = vi.fn();

    render(
      <Anidle
        mediaId={99}
        payload={payload}
        initialProgress={initialProgress}
        onProgressChange={onProgressChange}
      />,
    );

    await waitFor(() =>
      expect(screen.queryByRole("status")).not.toBeInTheDocument(),
    );
    expect(onProgressChange).toHaveBeenCalled();
    const latestCall =
      onProgressChange.mock.calls[onProgressChange.mock.calls.length - 1]?.[0];
    expect(latestCall?.anidleHistory).toHaveLength(guesses.length);
  });

  it("reuses stored evaluations without re-fetching", async () => {
    const evaluation: AnidleGuessEvaluation = {
      title: "Stored Guess",
      correct: false,
      year: { guess: null, target: null, status: "unknown" },
      averageScore: { guess: null, target: null, status: "unknown" },
      popularity: { guess: null, target: null, status: "unknown" },
      genres: [],
      tags: [],
      studios: [],
      source: [],
    };

    const initialProgress: GameProgress = {
      completed: false,
      round: 2,
      guesses: ["Stored Guess"],
      anidleHistory: [
        {
          guess: "Stored Guess",
          guessMediaId: 123,
          evaluation,
          evaluationVersion: CURRENT_ANIDLE_EVALUATION_VERSION,
          evaluatedAt: "2024-01-01T00:00:00.000Z",
        },
      ],
    };

    const onProgressChange = vi.fn();

    render(
      <Anidle
        mediaId={55}
        payload={payload}
        initialProgress={initialProgress}
        onProgressChange={onProgressChange}
      />,
    );

    expect(evaluateAnidleGuessMock).not.toHaveBeenCalled();
    expect(screen.getByText("Stored Guess")).toBeInTheDocument();
    expect(onProgressChange).toHaveBeenCalled();
    const latestCall =
      onProgressChange.mock.calls[onProgressChange.mock.calls.length - 1]?.[0];
    expect(latestCall?.anidleHistory?.[0]?.evaluation?.title).toBe(
      "Stored Guess",
    );
  });
});
