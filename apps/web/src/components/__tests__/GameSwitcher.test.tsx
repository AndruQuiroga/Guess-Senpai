import { render, screen, within } from "@testing-library/react";
import { vi } from "vitest";

import { GameSwitcher } from "../GameSwitcher";
import type { DailyProgress } from "../../types/progress";

vi.mock("../../hooks/useDailyAvailability", () => ({
  useRuntimeGamesDirectory: () => [
    { slug: "anidle", title: "Anidle", playable: true, gameKey: "anidle" },
    {
      slug: "poster-zoomed",
      title: "Poster",
      playable: true,
      gameKey: "poster_zoomed",
    },
  ],
}));

describe("GameSwitcher Anidle exhaustion", () => {
  it("shows an exhausted Anidle as finished, not Resume", () => {
    const progress: DailyProgress = {
      anidle: {
        completed: false,
        round: 1,
        guesses: ["a", "b"],
        anidleHistory: [{ guess: "a" }, { guess: "b" }],
        attemptLimit: 2,
      },
      poster_zoomed: { completed: false, round: 1, guesses: ["x"] },
    };
    render(<GameSwitcher progress={progress} />);
    const anidle = screen.getByRole("link", { name: /Anidle/ });
    expect(within(anidle).getByText("Out of guesses")).toBeInTheDocument();
    expect(within(anidle).queryByText(/Resume/)).toBeNull();
    const poster = screen.getByRole("link", { name: /Poster/ });
    expect(within(poster).getByText(/Resume/)).toBeInTheDocument();
  });
});
