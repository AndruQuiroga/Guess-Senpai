import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { AnidlePage } from "../puzzle-pages/AnidlePage";
import type { AnidleGame } from "../../types/puzzles";

vi.mock("../Anidle", () => ({ default: () => <div>Anidle board</div> }));

const payload = {
  rules: { version: "2", max_attempts: 8, hint_after_incorrect: [2, 4, 6] },
  spec: [{ difficulty: 1, hints: [] }],
  answer: "Answer",
  hints: { genres: [], tags: [], synopsis: [] },
} as AnidleGame;

describe("AnidlePage header", () => {
  it("keeps the legacy Round wording and no pips without v2 rules", () => {
    const { container } = render(
      <AnidlePage
        slug="anidle"
        mediaId={1}
        payload={{ ...payload, rules: null }}
        progress={{ completed: false, round: 2, guesses: ["a"] }}
        onProgressChange={() => {}}
      />,
    );
    expect(screen.getByText("Round 2")).toBeInTheDocument();
    expect(screen.queryByText(/Guess \d+ \/ 8/)).toBeNull();
    expect(container.querySelectorAll("[data-pip]")).toHaveLength(0);
  });

  it("counts guesses against the v2 budget instead of rounds", () => {
    const { container } = render(
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
    expect(container.querySelectorAll('[data-pip="used"]')).toHaveLength(2);
    expect(container.querySelectorAll("[data-pip]")).toHaveLength(8);
  });

  it("keeps the final count once the guesses are exhausted", () => {
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

  it("puts the Anidle rules behind the shell help button", () => {
    render(
      <AnidlePage
        slug="anidle"
        mediaId={1}
        payload={payload}
        onProgressChange={() => {}}
      />,
    );
    expect(
      screen.getByRole("button", { name: "How to play Anidle" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/in 8 accepted guesses/)).toBeInTheDocument();
  });
});
