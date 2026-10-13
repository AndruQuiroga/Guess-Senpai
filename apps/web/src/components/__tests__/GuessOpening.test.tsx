import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import GuessOpening from "../GuessOpening";
import type { GameProgress } from "../../types/progress";
import type { GuessOpeningRound } from "../../types/puzzles";

vi.mock("../../hooks/useTitleSuggestions", () => ({
  useTitleSuggestions: () => ({ suggestions: [], loading: false, error: null }),
}));

const verifyGuessMock = vi.hoisted(() => vi.fn());
vi.mock("../../utils/verifyGuess", () => ({
  verifyGuess: (...args: unknown[]) => verifyGuessMock(...args),
}));

function opening(
  order: number,
  mediaId: number,
  answer: string,
): GuessOpeningRound {
  return {
    order,
    difficulty: order,
    mediaId,
    spec: [],
    answer,
    clip: {
      audioUrl: null,
      videoUrl: `https://v.example/${mediaId}.webm`,
      lengthSeconds: 90,
      startSeconds: 10,
      endSeconds: 40,
    },
    meta: {
      artist: `Artist ${mediaId}`,
      songTitle: "Song",
      sequence: 1,
      season: null,
      genres: ["Action", "Drama"],
      year: 2019,
    },
    solution: {
      titles: { userPreferred: answer },
      coverImage: null,
      aniListUrl: `https://anilist.co/anime/${mediaId}`,
      streamingLinks: [],
    },
  };
}

const rounds = [
  opening(1, 1, "First"),
  opening(2, 2, "Second"),
  opening(3, 3, "Third"),
];
const mediaSrc = () => document.querySelector("video")?.getAttribute("src");

describe("GuessOpening rounds", () => {
  beforeEach(() => {
    verifyGuessMock.mockResolvedValue({ correct: true, animeMatch: true });
  });
  afterEach(() => vi.clearAllMocks());

  it("plays audio only, with no native controls, until the video clue is taken", () => {
    const progress = vi.fn();
    render(<GuessOpening payload={rounds} onProgressChange={progress} />);
    const video = document.querySelector("video")!;
    expect(video).not.toHaveAttribute("controls");
    expect(video.className).toContain("opacity-0");
    expect(screen.getByText(/0:00 \/ 0:30/)).toBeInTheDocument();

    // The video stays locked until the genres or the year is bought.
    const video_ = () =>
      screen.getByRole("button", { name: /buy video clue/i });
    expect(video_()).toBeDisabled();
    expect(
      screen.getByText("Buy the genres or year first"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /buy release year/i }));
    expect(screen.getByText("2019")).toBeInTheDocument();
    expect(video_()).toBeEnabled();
    fireEvent.click(video_());
    expect(document.querySelector("video")!.className).toContain(
      "aspect-video",
    );
    expect(progress.mock.calls.at(-1)?.[0].rounds[0]).toMatchObject({
      hints: 2,
      answers: { year: true, video: true },
    });
    // 1,000 − 150 (year) − 300 (video).
    expect(screen.getByRole("region", { name: "Clues" })).toHaveTextContent(
      "Playing for 550 / 1,000 pts",
    );
    expect(screen.queryByText(/artist/i)).toBeNull();
  });

  it("loads each round's own clip and scores with clue costs", async () => {
    const progress = vi.fn();
    render(<GuessOpening payload={rounds} onProgressChange={progress} />);
    expect(mediaSrc()).toBe("https://v.example/1.webm");

    fireEvent.click(screen.getByRole("button", { name: /buy genres/i }));
    expect(screen.getByText("Action · Drama")).toBeInTheDocument();
    fireEvent.change(
      screen.getByRole("combobox", { name: "Opening anime title" }),
      {
        target: { value: "First" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Lock in answer" }));

    expect(await screen.findByText("+850")).toBeInTheDocument();
    // The results screen plays the whole opening with controls.
    expect(document.querySelector("video")).toHaveAttribute("controls");
    const last = progress.mock.calls.at(-1)?.[0] as GameProgress;
    expect(last.rounds?.[0]).toMatchObject({ completed: true, points: 850 });

    fireEvent.click(screen.getByRole("button", { name: /Next round/ }));
    expect(mediaSrc()).toBe("https://v.example/2.webm");
  });

  it("defaults the window for older clips without one", () => {
    const legacy = opening(1, 9, "Old");
    legacy.clip = { videoUrl: "https://v.example/9.webm", lengthSeconds: 90 };
    render(<GuessOpening payload={[legacy]} onProgressChange={vi.fn()} />);
    expect(screen.getByText(/0:00 \/ 0:30/)).toBeInTheDocument();
  });
});
