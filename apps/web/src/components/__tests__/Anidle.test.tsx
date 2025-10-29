import { act, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import Anidle from "../Anidle";
import type { AnidleGame } from "../../types/puzzles";
import type { GameProgress } from "../../hooks/usePuzzleProgress";
import type { AnidleGuessEvaluation } from "../../utils/evaluateAnidleGuess";

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
    vi.useFakeTimers();
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
    vi.useRealTimers();
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

    await act(async () => {
      await vi.runAllTimersAsync();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(evaluateAnidleGuessMock).toHaveBeenCalledTimes(guesses.length);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/replaying your guesses/i),
    ).not.toBeInTheDocument();
    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(guesses.length + 1);
  });
});
