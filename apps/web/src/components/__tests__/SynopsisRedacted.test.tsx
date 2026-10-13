import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import SynopsisRedacted from "../SynopsisRedacted";
import type { GameProgress } from "../../types/progress";
import type {
  RedactedSynopsisGame,
  RedactedSynopsisRound,
} from "../../types/puzzles";

vi.mock("../../hooks/useTitleSuggestions", () => ({
  useTitleSuggestions: () => ({ suggestions: [], loading: false, error: null }),
}));

const verifyGuessMock = vi.hoisted(() => vi.fn());
vi.mock("../../utils/verifyGuess", () => ({
  verifyGuess: (...args: unknown[]) => verifyGuessMock(...args),
}));

const words =
  "A young alchemist searches for the stone to restore his brother".split(" ");

function synopsisRound(
  order: number,
  mediaId: number,
  answer: string,
): RedactedSynopsisRound {
  const segments = words.flatMap((text, index) => [
    { text, masked: index % 2 === 0 },
    ...(index < words.length - 1 ? [{ text: " ", masked: false }] : []),
  ]);
  return {
    order,
    difficulty: order,
    mediaId,
    answer,
    segments,
    masked_word_indices: segments
      .map((segment, index) => (segment.masked ? index : -1))
      .filter((index) => index >= 0),
    solution: {
      titles: { userPreferred: answer },
      coverImage: null,
      aniListUrl: `https://anilist.co/anime/${mediaId}`,
      streamingLinks: [],
    },
  };
}

const base: RedactedSynopsisGame = {
  spec: [],
  answer: "Legacy Show",
  text: "",
  segments: [
    { text: "Hidden", masked: true },
    { text: " plot", masked: false },
  ],
  masked_word_indices: [0],
  masked_words: ["Hidden"],
};

describe("SynopsisRedacted rounds", () => {
  beforeEach(() => {
    verifyGuessMock.mockResolvedValue({ correct: true, animeMatch: true });
  });
  afterEach(() => vi.clearAllMocks());

  it("plays three rounds, revealing words for a cost", async () => {
    const progress = vi.fn();
    const payload: RedactedSynopsisGame = {
      ...base,
      rounds: [
        synopsisRound(1, 1, "Fullmetal Alchemist"),
        synopsisRound(2, 2, "Second Show"),
        synopsisRound(3, 3, "Third Show"),
      ],
    };
    render(
      <SynopsisRedacted
        payload={payload}
        mediaId={1}
        onProgressChange={progress}
      />,
    );

    expect(
      screen.getByRole("button", { name: /Round 3 · Hard/ }),
    ).toBeDisabled();
    const hidden = screen.getAllByRole("img", { name: "redacted word" }).length;
    expect(hidden).toBe(6);

    fireEvent.click(
      screen.getByRole("button", { name: /buy reveal some words/i }),
    );
    expect(
      screen.getAllByRole("img", { name: "redacted word" }).length,
    ).toBeLessThan(hidden);
    expect(screen.getByText("1 of 3 bought")).toBeInTheDocument();

    fireEvent.change(
      screen.getByRole("combobox", { name: "Synopsis anime title" }),
      {
        target: { value: "Fullmetal Alchemist" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Lock in answer" }));

    expect(await screen.findByText("+850")).toBeInTheDocument();
    expect(verifyGuessMock).toHaveBeenCalledWith(
      1,
      "Fullmetal Alchemist",
      undefined,
    );
    const last = progress.mock.calls.at(-1)?.[0] as GameProgress;
    expect(last.rounds?.[0]).toMatchObject({
      completed: true,
      points: 850,
      hints: 1,
    });
  });

  it("scores a wrong answer as 0 and never charges below zero", async () => {
    verifyGuessMock.mockResolvedValue({ correct: false, animeMatch: false });
    const payload = {
      ...base,
      rounds: [synopsisRound(1, 1, "Fullmetal Alchemist")],
    };
    render(
      <SynopsisRedacted
        payload={payload}
        mediaId={1}
        onProgressChange={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /buy reveal some words/i }),
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "Synopsis anime title" }),
      {
        target: { value: "Naruto" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Lock in answer" }));
    expect(await screen.findByText("+0")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Missed" })).toBeInTheDocument();
  });

  it("requires a title before spending the round", async () => {
    render(
      <SynopsisRedacted
        payload={{ ...base, rounds: [synopsisRound(1, 1, "X")] }}
        mediaId={1}
        onProgressChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Lock in answer" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Type an anime title first",
    );
    expect(verifyGuessMock).not.toHaveBeenCalled();
  });

  it("plays older single-synopsis payloads as one round", () => {
    render(
      <SynopsisRedacted
        payload={base}
        mediaId={42}
        onProgressChange={vi.fn()}
      />,
    );
    expect(screen.getAllByRole("button", { name: /Round/ })).toHaveLength(1);
    expect(
      screen.getByRole("img", { name: "redacted word" }),
    ).toBeInTheDocument();
  });
});
