import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { UnlimitedAnidlePage } from "../puzzle-pages/UnlimitedAnidlePage";
import {
  PRACTICE_GAME_KEY,
  PRACTICE_SOURCE_KEY,
  PRACTICE_TALLY_KEY,
} from "../../utils/practiceAnidle";
import type { GameProgress } from "../../types/progress";

vi.mock("next/navigation", () => ({
  usePathname: () => "/games/anidle/unlimited",
}));

const board = vi.hoisted(() => ({
  progress: undefined as unknown,
}));

const accountState = vi.hoisted(() => ({ authenticated: false }));

vi.mock("../../hooks/useAccount", () => ({
  useAccount: () => ({
    account: { authenticated: accountState.authenticated },
    loading: false,
  }),
}));

// The board itself is covered elsewhere; this stub drives the page callbacks.
vi.mock("../Anidle", () => ({
  default: ({
    mediaId,
    onProgressChange,
    onNewPuzzle,
    initialProgress,
  }: {
    mediaId: number;
    onProgressChange: (state: GameProgress) => void;
    onNewPuzzle?: () => void;
    initialProgress?: GameProgress;
  }) => (
    <div>
      <p>Board for {mediaId}</p>
      <p>Initial guesses: {initialProgress?.guesses.length ?? 0}</p>
      <button
        type="button"
        onClick={() =>
          onProgressChange({
            completed: true,
            round: 1,
            guesses: ["a", "b", "c"],
            anidleHistory: [{ guess: "a" }, { guess: "b" }, { guess: "c" }],
            attemptLimit: 8,
          } as GameProgress)
        }
      >
        solve
      </button>
      <button
        type="button"
        onClick={() =>
          onProgressChange({
            completed: false,
            round: 1,
            guesses: Array.from({ length: 8 }, (_, i) => `g${i}`),
            anidleHistory: Array.from({ length: 8 }, (_, i) => ({
              guess: `g${i}`,
            })),
            attemptLimit: 8,
          } as GameProgress)
        }
      >
        exhaust
      </button>
      {onNewPuzzle ? (
        <button type="button" onClick={onNewPuzzle}>
          New puzzle
        </button>
      ) : null}
    </div>
  ),
}));

function practiceResponse(mediaId: number) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      practice_id: `practice:${mediaId}`,
      rules_version: "2",
      anidle: {
        mediaId,
        puzzle: {
          spec: [{ difficulty: 1, hints: ["synopsis"] }],
          answer: `Answer ${mediaId}`,
          hints: { genres: [], tags: [], synopsis: [] },
          rules: {
            version: "2",
            max_attempts: 8,
            hint_after_incorrect: [2, 4, 6],
          },
        },
        solution: { coverImage: null },
      },
    }),
  };
}

describe("UnlimitedAnidlePage", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    window.localStorage.clear();
    accountState.authenticated = false;
    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(practiceResponse(11))
      .mockResolvedValueOnce(practiceResponse(22))
      .mockResolvedValue(practiceResponse(33));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches a practice game and saves it under its own key", async () => {
    render(<UnlimitedAnidlePage />);
    expect(await screen.findByText("Board for 11")).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/puzzles/anidle/practice",
    );
    expect(screen.getByText(/Guess 1 \/ 8/)).toBeInTheDocument();
    expect(
      JSON.parse(window.localStorage.getItem(PRACTICE_GAME_KEY)!),
    ).toMatchObject({ practiceId: "practice:11", mediaId: 11 });
    expect(screen.getByLabelText("Practice tally")).toHaveTextContent(
      "Played 0 · Solved 0 · Avg —",
    );
  });

  it("tallies a solve once, never writes daily progress, and fetches a new puzzle", async () => {
    const user = userEvent.setup();
    render(<UnlimitedAnidlePage />);
    await screen.findByText("Board for 11");

    await user.click(screen.getByRole("button", { name: "solve" }));
    await user.click(screen.getByRole("button", { name: "solve" }));
    expect(screen.getByLabelText("Practice tally")).toHaveTextContent(
      "Played 1 · Solved 1 · Avg 3.0 guesses",
    );

    await user.click(screen.getByRole("button", { name: "New puzzle" }));
    expect(await screen.findByText("Board for 22")).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[1][0])).toContain("exclude=11");
    expect(screen.getByLabelText("Practice tally")).toHaveTextContent(
      "Played 1 · Solved 1",
    );

    // Everything stored belongs to practice; nothing touches the daily keys.
    const keys = Array.from(
      { length: window.localStorage.length },
      (_, index) => window.localStorage.key(index)!,
    );
    expect(keys.sort()).toEqual([PRACTICE_GAME_KEY, PRACTICE_TALLY_KEY].sort());
  });

  it("counts an exhausted game as played but not solved", async () => {
    const user = userEvent.setup();
    render(<UnlimitedAnidlePage />);
    await screen.findByText("Board for 11");
    await user.click(screen.getByRole("button", { name: "exhaust" }));
    expect(screen.getByLabelText("Practice tally")).toHaveTextContent(
      "Played 1 · Solved 0 · Avg —",
    );
  });

  it("does not tally a skipped game", async () => {
    const user = userEvent.setup();
    render(<UnlimitedAnidlePage />);
    await screen.findByText("Board for 11");
    await user.click(screen.getByRole("button", { name: "Skip this puzzle" }));
    expect(await screen.findByText("Board for 22")).toBeInTheDocument();
    expect(screen.getByLabelText("Practice tally")).toHaveTextContent(
      "Played 0",
    );
  });

  it("resumes the saved game and tally without fetching", async () => {
    window.localStorage.setItem(
      PRACTICE_GAME_KEY,
      JSON.stringify({
        practiceId: "practice:saved",
        mediaId: 77,
        puzzle: {
          spec: [],
          answer: "Saved",
          hints: { genres: [], tags: [], synopsis: [] },
          rules: {
            version: "2",
            max_attempts: 8,
            hint_after_incorrect: [2, 4, 6],
          },
        },
        coverImage: null,
        tallied: false,
        recentMediaIds: [77],
        progress: {
          completed: false,
          round: 1,
          guesses: ["x", "y"],
          anidleHistory: [{ guess: "x" }, { guess: "y" }],
        },
      }),
    );
    window.localStorage.setItem(
      PRACTICE_TALLY_KEY,
      JSON.stringify({ played: 4, solved: 3, solvedGuesses: 15 }),
    );
    render(<UnlimitedAnidlePage />);
    expect(await screen.findByText("Board for 77")).toBeInTheDocument();
    expect(screen.getByText("Initial guesses: 2")).toBeInTheDocument();
    expect(screen.getByText(/Guess 3 \/ 8/)).toBeInTheDocument();
    expect(screen.getByLabelText("Practice tally")).toHaveTextContent(
      "Played 4 · Solved 3 · Avg 5.0 guesses",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("offers a retry when the practice puzzle cannot load", async () => {
    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) })
      .mockResolvedValueOnce(practiceResponse(44));
    const user = userEvent.setup();
    render(<UnlimitedAnidlePage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("503");
    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Try again" }));
    });
    await waitFor(() =>
      expect(screen.getByText("Board for 44")).toBeInTheDocument(),
    );
  });

  it("disables the list source and offers sign-in when signed out", async () => {
    render(<UnlimitedAnidlePage />);
    await screen.findByText("Board for 11");
    expect(
      screen.getByRole("radio", { name: "Popular anime" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "My AniList list" })).toBeDisabled();
    expect(
      screen.getByRole("link", { name: "Sign in with AniList" }),
    ).toHaveAttribute("href", "/login");
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("source=");
  });

  it("switches to the AniList list, remembers it and sends the session cookie", async () => {
    accountState.authenticated = true;
    const user = userEvent.setup();
    render(<UnlimitedAnidlePage />);
    await screen.findByText("Board for 11");

    await user.click(screen.getByRole("radio", { name: "My AniList list" }));
    expect(await screen.findByText("Board for 22")).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[1];
    expect(String(url)).toContain("source=list");
    expect(init).toMatchObject({ credentials: "include" });
    expect(
      screen.getByRole("radio", { name: "My AniList list" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(window.localStorage.getItem(PRACTICE_SOURCE_KEY)).toBe('"list"');

    // The next puzzle keeps drawing from the list.
    await user.click(screen.getByRole("button", { name: "Skip this puzzle" }));
    expect(await screen.findByText("Board for 33")).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[2][0])).toContain("source=list");
  });

  it("asks a signed-out player with a saved list choice to sign in", async () => {
    window.localStorage.setItem(PRACTICE_SOURCE_KEY, JSON.stringify("list"));
    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ detail: "Authentication required" }),
      })
      .mockResolvedValueOnce(practiceResponse(55));
    const user = userEvent.setup();
    render(<UnlimitedAnidlePage />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sign in with AniList to practise from your list.",
    );
    await user.click(
      screen.getByRole("button", { name: "Play popular anime instead" }),
    );
    expect(await screen.findByText("Board for 55")).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[1][0])).not.toContain("source=");
  });

  it("shows the server's reason when the list has nothing to play", async () => {
    accountState.authenticated = true;
    window.localStorage.setItem(PRACTICE_SOURCE_KEY, JSON.stringify("list"));
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({
        detail: "Your AniList list has no watched anime yet.",
      }),
    });
    render(<UnlimitedAnidlePage />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "no watched anime yet",
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
