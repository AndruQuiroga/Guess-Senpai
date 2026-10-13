import { render, screen, within } from "@testing-library/react";
import { vi } from "vitest";

import HomePage from "../page";
import {
  buildRuntimeGamesDirectory,
  getPlayableGames,
} from "../../config/games";

const state = vi.hoisted(() => ({
  daily: null as null | Record<string, string>,
  error: false,
  opening: false,
  progress: {} as Record<string, unknown>,
}));

vi.mock("../../hooks/useDailyAvailability", async () => {
  const config = await import("../../config/games");
  return {
    useDailyAvailability: () => ({
      daily: state.daily,
      error: state.error,
      refresh: vi.fn(),
    }),
    useRuntimeGamesDirectory: () =>
      config.getPlayableGames(
        config.buildRuntimeGamesDirectory({
          guessTheOpeningEnabled: state.opening,
        }),
      ),
  };
});
vi.mock("../../hooks/usePuzzleProgress", () => ({
  PuzzleProgressProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  usePuzzleProgress: () => ({ progress: state.progress }),
}));
vi.mock("../../hooks/useAccount", () => ({
  useAccount: () => ({
    account: { authenticated: false },
    loading: false,
    error: null,
  }),
  useAccountStreak: () => ({
    streak: { count: 0, lastCompleted: null },
    error: null,
  }),
}));
vi.mock("../../components/DailyRolloverNotice", () => ({
  DailyRolloverNotice: () => null,
}));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

const daily = {
  date: "2026-10-12",
  puzzle_id: "daily:2026-10-12",
  rules_version: "1",
};

describe("Today page", () => {
  beforeEach(() => {
    state.daily = daily;
    state.error = false;
    state.opening = false;
    state.progress = {};
  });

  it("renders one equal tile per playable mode, each linking straight into the game", () => {
    render(<HomePage />);
    const list = screen.getByRole("list", { name: "Daily puzzles" });
    const links = within(list).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/games/anidle",
      "/games/poster-zoomed",
      "/games/character-silhouette",
      "/games/redacted-synopsis",
    ]);
    for (const link of links) expect(link).toHaveTextContent("New");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("drops the old hero copy and hidden modes", () => {
    render(<HomePage />);
    for (const text of [
      /TODAY ·/,
      /DAILY PUZZLE/,
      /ALSO IN TODAY/,
      /More puzzles/,
      /A little anime knowledge/,
      /Mystery Voice/,
      /Emoji Synopsis/,
      /Quote Quiz/,
      /Guess the Opening/,
    ]) {
      expect(screen.queryByText(text)).toBeNull();
    }
  });

  it("shows status from progress, including out of guesses", () => {
    state.progress = {
      anidle: { completed: true, round: 1, guesses: ["a"] },
      poster_zoomed: { completed: false, round: 1, guesses: ["a"] },
      redacted_synopsis: {
        completed: false,
        round: 1,
        guesses: ["a", "b"],
        anidleHistory: [{}, {}],
        attemptLimit: 2,
      },
    };
    render(<HomePage />);
    expect(screen.getByRole("link", { name: /Anidle/ })).toHaveTextContent(
      "Solved",
    );
    expect(
      screen.getByRole("link", { name: /Poster Zoomed/ }),
    ).toHaveTextContent("In progress");
    expect(
      screen.getByRole("link", { name: /Redacted Synopsis/ }),
    ).toHaveTextContent("Out of guesses");
  });

  it("adds Guess the Opening only when today's availability enables it", () => {
    state.opening = true;
    render(<HomePage />);
    expect(
      screen.getByRole("link", { name: /Guess the Opening/ }),
    ).toHaveAttribute("href", "/games/guess-the-opening");
  });

  it("keeps the loading and error/retry states", () => {
    state.daily = null;
    const { rerender } = render(<HomePage />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    state.error = true;
    rerender(<HomePage />);
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});

describe("game availability source of truth", () => {
  it("never lists unreleased modes and gates the opening on availability", () => {
    const off = getPlayableGames(
      buildRuntimeGamesDirectory({ guessTheOpeningEnabled: false }),
    ).map((game) => game.slug);
    expect(off).toEqual([
      "anidle",
      "poster-zoomed",
      "character-silhouette",
      "redacted-synopsis",
    ]);
    const on = getPlayableGames(
      buildRuntimeGamesDirectory({ guessTheOpeningEnabled: true }),
    ).map((game) => game.slug);
    expect(on).toContain("guess-the-opening");
    expect(on).not.toContain("mystery-voice");
  });
});
