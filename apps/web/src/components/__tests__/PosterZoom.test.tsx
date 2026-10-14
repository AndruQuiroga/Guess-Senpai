import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import PosterZoom from "../PosterZoom";
import type { GameProgress } from "../../types/progress";
import type { PosterZoomGame, PosterZoomRound } from "../../types/puzzles";

vi.mock("../../hooks/useTitleSuggestions", () => ({
  useTitleSuggestions: () => ({ suggestions: [], loading: false, error: null }),
}));

const verifyGuessMock = vi.hoisted(() => vi.fn());
vi.mock("../../utils/verifyGuess", () => ({
  verifyGuess: (...args: unknown[]) => verifyGuessMock(...args),
}));

function round(
  order: number,
  mediaId: number,
  answer: string,
): PosterZoomRound {
  return {
    order,
    difficulty: order,
    mediaId,
    answer,
    meta: {
      genres: ["Action", "Drama"],
      year: 2004,
      season: "Fall 2004",
      format: "TV",
      seasonNumber: 2,
      seasonOptions: [1, 2],
    },
    cropStages: [],
    solution: {
      titles: { userPreferred: answer },
      coverImage: `https://img.example/${mediaId}.jpg`,
      aniListUrl: `https://anilist.co/anime/${mediaId}`,
      streamingLinks: [],
    },
  };
}

const payload: PosterZoomGame = {
  spec: [],
  rounds: [
    round(1, 11, "Bleach"),
    round(2, 22, "Toradora!"),
    round(3, 33, "Elfen Lied"),
  ],
};

const posterSrc = () =>
  (screen.getByAltText(/Zoomed-in crop/) as HTMLImageElement).getAttribute(
    "src",
  );

describe("PosterZoom rounds", () => {
  beforeEach(() => {
    verifyGuessMock.mockResolvedValue({ correct: true, animeMatch: true });
  });
  afterEach(() => vi.clearAllMocks());

  it("starts on the Easy round with a zoomed crop and no free metadata", () => {
    render(<PosterZoom payload={payload} onProgressChange={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: /Round 1 · Easy/ }),
    ).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("button", { name: /Round 2/ })).toBeDisabled();
    expect(posterSrc()).toContain(
      "/puzzles/poster/11/image?hints=0&difficulty=1",
    );
    // Season, year and genres are never shown for free.
    expect(screen.queryByText("Fall 2004")).toBeNull();
    expect(screen.queryByText("Action")).toBeNull();
  });

  it("charges for hints and scores title, season and year in one submission", async () => {
    const progress = vi.fn();
    render(<PosterZoom payload={payload} onProgressChange={progress} />);

    fireEvent.click(screen.getByRole("button", { name: /buy zoom out/i }));
    expect(posterSrc()).toContain("hints=1");
    expect(progress).toHaveBeenLastCalledWith(
      expect.objectContaining({
        rounds: expect.arrayContaining([
          expect.objectContaining({ round: 1, hints: 1 }),
        ]),
      }),
    );

    fireEvent.change(
      screen.getByRole("combobox", { name: "Poster anime title" }),
      {
        target: { value: "Bleach" },
      },
    );
    fireEvent.click(screen.getByRole("radio", { name: /Fall/i }));
    fireEvent.change(screen.getByLabelText("Release year"), {
      target: { value: "2005" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lock in answer" }));

    // 600 title + 50 (year off by one); season needs exact year; −150 hint.
    expect(await screen.findByText("+500")).toBeInTheDocument();
    expect(verifyGuessMock).toHaveBeenCalledWith(11, "Bleach", undefined);
    expect(screen.getByAltText("Cover art for Bleach")).toHaveAttribute(
      "src",
      "https://img.example/11.jpg",
    );
    const last = progress.mock.calls.at(-1)?.[0] as GameProgress;
    expect(last.completed).toBe(false);
    expect(last.round).toBe(2);
    expect(last.rounds?.[0]).toMatchObject({
      completed: true,
      points: 500,
      hints: 1,
    });

    fireEvent.click(screen.getByRole("button", { name: /Next round/ }));
    expect(posterSrc()).toContain(
      "/puzzles/poster/22/image?hints=0&difficulty=2",
    );
  });

  it("refuses a completely blank answer without spending the round", async () => {
    const progress = vi.fn();
    render(<PosterZoom payload={payload} onProgressChange={progress} />);
    fireEvent.click(screen.getByRole("button", { name: "Lock in answer" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "anime title first",
    );
    expect(verifyGuessMock).not.toHaveBeenCalled();
    expect(progress).not.toHaveBeenCalled();
  });

  it("resumes on the first unplayed round and ends on a summary", async () => {
    const outcome = (points: number) => ({
      lines: [
        {
          label: "Title",
          guess: "x",
          answer: "y",
          verdict: "correct",
          points,
          max: 600,
        },
      ],
      hintPenalty: 0,
      points,
      max: 1000,
    });
    const initialProgress: GameProgress = {
      completed: false,
      round: 3,
      guesses: ["a", "b"],
      rounds: [
        {
          round: 1,
          guesses: ["a"],
          completed: true,
          points: 600,
          result: outcome(600),
        },
        {
          round: 2,
          guesses: ["b"],
          completed: true,
          points: 400,
          result: outcome(400),
        },
      ],
    };
    render(
      <PosterZoom
        payload={payload}
        initialProgress={initialProgress}
        onProgressChange={vi.fn()}
      />,
    );
    expect(posterSrc()).toContain("/poster/33/");

    fireEvent.change(
      screen.getByRole("combobox", { name: "Poster anime title" }),
      {
        target: { value: "Elfen Lied" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Lock in answer" }));
    fireEvent.click(
      await screen.findByRole("button", { name: /See final score/ }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Poster Zoomed complete" }),
      ).toBeInTheDocument(),
    );
    // 600 + 400 + 600 (title only, no season or year).
    expect(screen.getByText("1,600")).toBeInTheDocument();
  });

  it("picks up saved progress that arrives after the game mounted", () => {
    const view = render(
      <PosterZoom payload={payload} onProgressChange={vi.fn()} />,
    );
    expect(posterSrc()).toContain("/poster/11/");
    const saved: GameProgress = {
      completed: false,
      round: 2,
      guesses: ["a"],
      rounds: [
        {
          round: 1,
          guesses: ["a"],
          completed: true,
          points: 800,
          result: { lines: [], hintPenalty: 0, points: 800, max: 1000 },
        },
      ],
    };
    view.rerender(
      <PosterZoom
        payload={payload}
        initialProgress={saved}
        onProgressChange={vi.fn()}
      />,
    );
    expect(posterSrc()).toContain("/poster/22/");
    expect(
      screen.getByRole("button", { name: /Round 1 · Easy/ }),
    ).toHaveTextContent("800");
  });

  it("shows a finished-before-update note for legacy progress", () => {
    render(
      <PosterZoom
        payload={payload}
        initialProgress={{
          completed: true,
          round: 3,
          guesses: ["a"],
          rounds: [],
        }}
        onProgressChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/before the new round format/)).toBeInTheDocument();
  });

  it("adds independent release and numbered-season bonuses and preserves the maximum", async () => {
    const progress = vi.fn();
    render(<PosterZoom payload={payload} onProgressChange={progress} />);
    fireEvent.change(
      screen.getByRole("combobox", { name: "Poster anime title" }),
      { target: { value: "Bleach" } },
    );
    fireEvent.change(screen.getByLabelText("Release year"), {
      target: { value: "2004" },
    });
    fireEvent.click(screen.getByRole("radio", { name: /Fall/i }));
    fireEvent.click(screen.getByRole("radio", { name: "Season 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Lock in answer" }));
    expect(await screen.findByText("+1,000")).toBeInTheDocument();
    expect(progress.mock.calls.at(-1)?.[0]).toMatchObject({
      maxPoints: 3000,
      rounds: [
        expect.objectContaining({
          points: 1000,
          answers: expect.objectContaining({ seasonNumber: "2" }),
        }),
        expect.anything(),
        expect.anything(),
      ],
    });
  });

  it("hides numbered seasons for a sole-season show but keeps release bonuses", () => {
    const singleSeason = {
      ...payload,
      rounds: payload.rounds.map((round) => ({
        ...round,
        meta: { ...round.meta, seasonNumber: 1, seasonOptions: [] },
      })),
    };
    render(<PosterZoom payload={singleSeason} onProgressChange={vi.fn()} />);
    expect(
      screen.queryByLabelText("Numbered season (+200)"),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Release year")).toBeInTheDocument();
    expect(screen.getByLabelText("Release season")).toBeInTheDocument();
  });

  it("uses the stored poster effect independently of the round difficulty", () => {
    const modified = {
      ...payload,
      rounds: payload.rounds.map((round, index) => ({
        ...round,
        meta: {
          ...round.meta,
          modification: (["shuffled", "spotlight", "mosaic"] as const)[index],
        },
      })),
    };
    const progress = vi.fn();
    render(
      <PosterZoom modified payload={modified} onProgressChange={progress} />,
    );
    const image = screen.getByAltText("Shuffled tiles poster for round 1");
    expect(image).toHaveAttribute(
      "src",
      expect.stringContaining("modification=shuffled"),
    );
    fireEvent.click(screen.getByRole("button", { name: /buy clearer image/i }));
    expect(image).toHaveAttribute("src", expect.stringContaining("hints=1"));
    expect(progress.mock.calls.at(-1)?.[0].rounds[0].hints).toBe(1);
  });
});
