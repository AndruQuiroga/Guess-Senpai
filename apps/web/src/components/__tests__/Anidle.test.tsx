import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { vi } from "vitest";

import Anidle from "../Anidle";
import { StakeBadge, StakeProvider } from "../rounds/RoundUI";
import type { AnidleGame } from "../../types/puzzles";
import type { GameProgress } from "../../hooks/usePuzzleProgress";
import {
  CURRENT_ANIDLE_EVALUATION_VERSION,
  type AnidleGuessEvaluation,
} from "../../types/anidle";

const evaluateAnidleGuessMock = vi.hoisted(() =>
  vi.fn(
    async ({ guess }: { guess: string }): Promise<AnidleGuessEvaluation> => {
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
    },
  ),
);

vi.mock("../../utils/evaluateAnidleGuess", () => ({
  evaluateAnidleGuess: (
    payload: Parameters<typeof evaluateAnidleGuessMock>[0],
  ) => evaluateAnidleGuessMock(payload),
  evaluateAnidleGuessBatch: async (
    payloads: Parameters<typeof evaluateAnidleGuessMock>[0][],
  ) => Promise.all(payloads.map((payload) => evaluateAnidleGuessMock(payload))),
}));

vi.mock("../../hooks/useTitleSuggestions", () => ({
  useTitleSuggestions: () => ({
    suggestions: [{ id: 7, title: "Retryable Guess" }],
    loading: false,
    error: null,
  }),
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

  it("preserves the selected title and spends no attempt when evaluation fails", async () => {
    evaluateAnidleGuessMock.mockRejectedValueOnce(new Error("API unavailable"));
    render(
      <Anidle mediaId={77} payload={payload} onProgressChange={vi.fn()} />,
    );
    const input = screen.getByRole("combobox", { name: "Anidle guess" });
    fireEvent.change(input, { target: { value: "Retryable Guess" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit Guess" }));

    expect(await screen.findByText("API unavailable")).toBeInTheDocument();
    expect(input).toHaveValue("Retryable Guess");
    expect(screen.queryByText(/Guess history/)).not.toBeInTheDocument();
  });

  it("treats native share cancellation as neutral after solving", async () => {
    const solvedEvaluation: AnidleGuessEvaluation = {
      title: "Correct Title",
      correct: true,
      year: { guess: null, target: null, status: "unknown" },
      averageScore: { guess: null, target: null, status: "unknown" },
      popularity: { guess: null, target: null, status: "unknown" },
      genres: [],
      tags: [],
      studios: [],
      source: [],
    };
    const share = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error("cancel"), { name: "AbortError" }),
      );
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: share,
    });
    render(
      <Anidle
        mediaId={8}
        payload={payload}
        onProgressChange={vi.fn()}
        initialProgress={{
          completed: true,
          round: 1,
          guesses: ["Correct Title"],
          anidleHistory: [
            {
              guess: "Correct Title",
              guessMediaId: 4,
              evaluation: solvedEvaluation,
              evaluationVersion: CURRENT_ANIDLE_EVALUATION_VERSION,
            },
          ],
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Share result" }));
    await waitFor(() => expect(share).toHaveBeenCalledOnce());
    expect(
      screen.queryByText(/Share could not be opened/),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Correct Title");
  });

  const finitePayload: AnidleGame = {
    ...payload,
    spec: [{ difficulty: 1, hints: ["synopsis"] }],
    rules: { version: "2", max_attempts: 8, hint_after_incorrect: [2, 4, 6] },
    hints: {
      genres: ["Adventure"],
      tags: ["Space"],
      year: 2001,
      synopsis: [
        { ratio: 0.2, text: "First clue" },
        { ratio: 0.35, text: "Second clue" },
        { ratio: 0.5, text: "Third clue" },
      ],
    },
  };

  function stored(count: number, lastCorrect = false): GameProgress {
    const history = Array.from({ length: count }, (_, index) => ({
      guess: `Anime ${index}`,
      guessMediaId: index + 100,
      evaluation: {
        title: `Anime ${index}`,
        correct: lastCorrect && index === count - 1,
        year: { guess: null, target: null, status: "unknown" as const },
        averageScore: { guess: null, target: null, status: "unknown" as const },
        popularity: { guess: null, target: null, status: "unknown" as const },
        genres: [],
        tags: [],
        studios: [],
        source: [],
      },
      evaluationVersion: CURRENT_ANIDLE_EVALUATION_VERSION,
    }));
    return {
      completed: lastCorrect,
      round: 1,
      guesses: history.map((entry) => entry.guess),
      anidleHistory: history,
    };
  }

  it("resumes with exactly the clues that were bought", () => {
    render(
      <Anidle
        mediaId={88}
        payload={finitePayload}
        initialProgress={{
          ...stored(6),
          anidleHints: ["year", "synopsis"],
        }}
        onProgressChange={vi.fn()}
      />,
    );
    expect(screen.getByText("2001")).toBeInTheDocument();
    // The excerpt is the middle redaction level.
    expect(screen.getByText("Second clue")).toBeInTheDocument();
    expect(screen.queryByText("Adventure")).not.toBeInTheDocument();
    expect(evaluateAnidleGuessMock).not.toHaveBeenCalled();
  });

  it("maps older saves that stored a hint count onto the first clue types", () => {
    render(
      <Anidle
        mediaId={88}
        payload={finitePayload}
        initialProgress={{ ...stored(6), hintsRevealed: 1 }}
        onProgressChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Adventure")).toBeInTheDocument();
    expect(screen.queryByText("2001")).not.toBeInTheDocument();
  });

  it("sells three separately priced clues, each unlocking on its own", () => {
    const progress = vi.fn();
    render(
      <StakeProvider>
        <StakeBadge />
        <Anidle
          mediaId={88}
          payload={finitePayload}
          initialProgress={stored(4)}
          onProgressChange={progress}
        />
      </StakeProvider>,
    );
    // 8 guesses, 4 used: solving next scores 3,000 × 4/8.
    expect(
      screen.getByRole("status", { name: /1,500 of 3,000/ }),
    ).toBeInTheDocument();
    // Genres (after 2) and year (after 4) are open; the excerpt needs 6 misses.
    expect(
      screen.getByRole("button", { name: /buy synopsis excerpt/i }),
    ).toBeDisabled();
    expect(
      screen.getByText(/Synopsis excerpt: after 2 more misses/),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /buy release year for 150/i }),
    );
    expect(screen.getByText("2001")).toBeInTheDocument();
    expect(screen.queryByText("Adventure")).not.toBeInTheDocument();
    expect(progress).toHaveBeenLastCalledWith(
      expect.objectContaining({ anidleHints: ["year"] }),
    );
    expect(
      screen.getByRole("status", {
        name: /1,350 of 3,000 points available, 1,650 spent/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Release year: bought" }),
    ).toBeDisabled();
  });

  it("accepts the eighth miss, reveals the answer, and resumes exhaustion without awarding a solve", async () => {
    const progress = vi.fn();
    const view = render(
      <Anidle
        mediaId={88}
        payload={finitePayload}
        initialProgress={stored(7)}
        onProgressChange={progress}
      />,
    );
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "Last miss" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit Guess" }));
    expect(
      await screen.findByText("Out of guesses · Answer revealed"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    const saved = progress.mock.calls.at(-1)![0];
    expect(saved.completed).toBe(false);
    expect(saved.guesses).toHaveLength(8);
    view.unmount();
    render(
      <Anidle
        mediaId={88}
        payload={finitePayload}
        initialProgress={saved}
        onProgressChange={vi.fn()}
      />,
    );
    expect(
      screen.getByText("Out of guesses · Answer revealed"),
    ).toBeInTheDocument();
  });

  it("allows a solve on the final attempt", async () => {
    render(
      <Anidle
        mediaId={88}
        payload={finitePayload}
        initialProgress={stored(7)}
        onProgressChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "Correct Title" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit Guess" }));
    expect(await screen.findByText("Solved in 8/8")).toBeInTheDocument();
    expect(
      screen.queryByText("Out of guesses · Answer revealed"),
    ).not.toBeInTheDocument();
  });

  it("rejects empty, repeated titles and canonical aliases without spending an attempt", async () => {
    const progress = vi.fn();
    render(
      <Anidle
        mediaId={88}
        payload={finitePayload}
        initialProgress={stored(1)}
        onProgressChange={progress}
      />,
    );
    const input = screen.getByRole("combobox");
    const submit = screen.getByRole("button", { name: "Submit Guess" });
    fireEvent.click(submit);
    expect(evaluateAnidleGuessMock).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: " ANIME 0 " } });
    fireEvent.click(submit);
    expect(screen.getByText(/already guessed/)).toBeInTheDocument();
    expect(evaluateAnidleGuessMock).not.toHaveBeenCalled();
    evaluateAnidleGuessMock.mockImplementationOnce(
      async () => stored(1).anidleHistory![0].evaluation!,
    );
    fireEvent.change(input, { target: { value: "Alias" } });
    fireEvent.click(submit);
    await waitFor(() => expect(evaluateAnidleGuessMock).toHaveBeenCalledOnce());
    await waitFor(() => expect(submit).toHaveTextContent(/^Guess$/));
    expect(progress.mock.calls.at(-1)![0].guesses).toHaveLength(1);
  });

  it("keeps invalid evaluation retries free under the new rules", async () => {
    evaluateAnidleGuessMock.mockRejectedValueOnce(new Error("Unknown title"));
    render(
      <Anidle
        mediaId={88}
        payload={finitePayload}
        initialProgress={stored(7)}
        onProgressChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "Invalid" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit Guess" }));
    expect(await screen.findByText("Unknown title")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveValue("Invalid");
    expect(
      screen.queryByText("Out of guesses · Answer revealed"),
    ).not.toBeInTheDocument();
  });

  it("does not spend an attempt on a title that matches no anime", async () => {
    evaluateAnidleGuessMock.mockImplementationOnce(async () => ({
      ...stored(1).anidleHistory![0].evaluation!,
      title: "zzqq",
      matched: false,
    }));
    render(
      <Anidle
        mediaId={88}
        payload={finitePayload}
        initialProgress={stored(7)}
        onProgressChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "zzqq" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit Guess" }));
    expect(
      await screen.findByText(/couldn't find that anime/),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveValue("zzqq");
    expect(
      screen.queryByText("Out of guesses · Answer revealed"),
    ).not.toBeInTheDocument();
  });

  it("keeps legacy long play unlimited with hints at ten misses", () => {
    render(
      <Anidle
        mediaId={88}
        payload={{ ...payload, hints: finitePayload.hints }}
        initialProgress={stored(12)}
        onProgressChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByText("Second clue")).toBeInTheDocument();
  });

  it("offers tags as the third clue when no synopsis exists", () => {
    const view = render(
      <Anidle
        mediaId={88}
        payload={{
          ...finitePayload,
          hints: { ...finitePayload.hints, synopsis: [] },
        }}
        initialProgress={stored(6)}
        onProgressChange={vi.fn()}
      />,
    );
    // Without a synopsis the third clue sells the tags instead.
    fireEvent.click(screen.getByRole("button", { name: /buy tags/i }));
    expect(screen.getByText("Space")).toBeInTheDocument();
    view.unmount();
  });
});
