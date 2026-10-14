import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import GuessOpening from "../GuessOpening";
import { clipWindow } from "../games/OpeningPlayer";
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
const mediaSrc = () =>
  document.querySelector("audio, video")?.getAttribute("src");

describe("GuessOpening rounds", () => {
  beforeEach(() => {
    verifyGuessMock.mockResolvedValue({ correct: true, animeMatch: true });
  });
  afterEach(() => vi.clearAllMocks());

  it("plays audio only, with no native controls, until the video clue is taken", () => {
    const progress = vi.fn();
    render(<GuessOpening payload={rounds} onProgressChange={progress} />);
    const audio = document.querySelector("audio")!;
    expect(audio).not.toHaveAttribute("controls");
    expect(document.querySelector("video")).toBeNull();
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
    // The video clue is blurred, never the clean picture.
    expect(document.querySelector("video")!.style.filter).toContain("blur");
    expect(progress.mock.calls.at(-1)?.[0].rounds[0]).toMatchObject({
      hints: 2,
      answers: { year: true, video: true },
    });
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

  it("earns release and numbered-season bonuses in the same submission", async () => {
    const progress = vi.fn();
    const bonusRounds = rounds.map((round) => ({
      ...round,
      meta: {
        ...round.meta,
        season: "SPRING 2019",
        seasonNumber: 2,
        seasonOptions: [1, 2],
      },
    }));
    render(<GuessOpening payload={bonusRounds} onProgressChange={progress} />);
    fireEvent.change(
      screen.getByRole("combobox", { name: "Opening anime title" }),
      { target: { value: "First" } },
    );
    fireEvent.change(screen.getByLabelText("Release year"), {
      target: { value: "2019" },
    });
    fireEvent.click(screen.getByRole("radio", { name: /Spring/i }));
    fireEvent.click(screen.getByRole("radio", { name: "Season 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Lock in answer" }));
    expect(await screen.findByText("+1,400")).toBeInTheDocument();
    expect(progress.mock.calls.at(-1)?.[0]).toMatchObject({
      maxPoints: 4200,
      rounds: [
        expect.objectContaining({
          points: 1400,
          answers: expect.objectContaining({
            releaseYear: "2019",
            releaseSeason: "SPRING",
            seasonNumber: "2",
          }),
        }),
        expect.anything(),
        expect.anything(),
      ],
    });
  });

  it("plays the light audio file and falls back to the video's sound", () => {
    const round = opening(1, 4, "Fallback");
    round.clip.audioUrl = "https://a.example/4.ogg";
    render(<GuessOpening payload={[round]} onProgressChange={vi.fn()} />);
    expect(mediaSrc()).toBe("https://a.example/4.ogg");
    fireEvent.error(document.querySelector("audio")!);
    expect(mediaSrc()).toBe("https://v.example/4.webm");
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.error(document.querySelector("audio")!);
    expect(screen.getByRole("alert")).toHaveTextContent(/couldn.t play/i);
  });
});

describe("clipWindow", () => {
  it("never plays the first or last 20 seconds", () => {
    // Never earlier than 20s, whatever the payload says.
    expect(clipWindow({ startSeconds: 10, endSeconds: 40 })).toEqual({
      start: 20,
      end: 50,
    });
    // A short 60s cut keeps a fifth (12s) clear at each end instead.
    expect(clipWindow({ startSeconds: 30, endSeconds: 60 }, 60)).toEqual({
      start: 18,
      end: 48,
    });
    expect(clipWindow({ startSeconds: 25, endSeconds: 55 }, 89)).toEqual({
      start: 25,
      end: 55,
    });
  });
});
