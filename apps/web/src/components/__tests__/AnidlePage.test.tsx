import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { AnidlePage } from "../puzzle-pages/AnidlePage";
import type { AnidleGame } from "../../types/puzzles";

vi.mock("../Anidle", () => ({ default: () => <div>Anidle board</div> }));
vi.mock("../GameSwitcher", () => ({ default: () => null }));

const payload = {
  rules: { version: "2", max_attempts: 8, hint_after_incorrect: [2, 4, 6] },
  spec: [{ difficulty: 1, hints: [] }],
  answer: "Answer",
  hints: { genres: [], tags: [], synopsis: [] },
} as AnidleGame;

describe("AnidlePage header", () => {
  // Stage A2 removed the shell's round badge. Stage B re-adds "Guess n / 8" via
  // GameShell's `status` slot and should un-skip these two tests.
  it("renders no round badge in the shell header", () => {
    render(
      <AnidlePage
        slug="anidle"
        mediaId={1}
        payload={payload}
        progress={{ completed: false, round: 1, guesses: ["a"] }}
        onProgressChange={() => {}}
      />,
    );
    expect(screen.queryByText(/Guess \d+ \/ 8/)).toBeNull();
    expect(screen.queryByText(/Round \d/)).toBeNull();
  });

  it.skip("counts guesses against the v2 budget instead of rounds", () => {
    render(
      <AnidlePage
        slug="anidle"
        mediaId={1}
        payload={payload}
        progress={{
          completed: false,
          round: 1,
          guesses: ["a", "b"],
          anidleHistory: [{ guess: "a" }, { guess: "b" }],
        }}
        onProgressChange={() => {}}
      />,
    );
    expect(screen.getByText("Guess 3 / 8")).toBeInTheDocument();
    expect(screen.queryByText(/Round/)).toBeNull();
  });

  it.skip("keeps the final count once the guesses are exhausted", () => {
    const history = Array.from({ length: 8 }, (_, i) => ({ guess: `g${i}` }));
    render(
      <AnidlePage
        slug="anidle"
        mediaId={1}
        payload={payload}
        progress={{
          completed: false,
          round: 1,
          guesses: history.map((h) => h.guess),
          anidleHistory: history,
          attemptLimit: 8,
        }}
        onProgressChange={() => {}}
      />,
    );
    expect(screen.getByText("Guess 8 / 8")).toBeInTheDocument();
  });
});
