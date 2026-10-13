import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { vi } from "vitest";
import { AnidlePage } from "../puzzle-pages/AnidlePage";
import type { GameProgress } from "../../types/progress";
import { CURRENT_ANIDLE_EVALUATION_VERSION } from "../../types/anidle";

vi.mock("../../hooks/useTitleSuggestions", () => ({
  useTitleSuggestions: () => ({ suggestions: [], loading: false, error: null }),
}));

const payload = {
  rules: { version: "2", max_attempts: 20, hint_after_incorrect: [2, 4, 6] },
  spec: [{ difficulty: 1, hints: [] }],
  answer: "Answer",
  hints: {
    genres: ["Action"],
    tags: [],
    synopsis: [{ ratio: 0.2, text: "First clue" }],
  },
} as const;

function initial(): GameProgress {
  const history = [0, 1, 2].map((i) => ({
    guess: `G${i}`,
    guessMediaId: i + 1,
    evaluationVersion: CURRENT_ANIDLE_EVALUATION_VERSION,
    evaluation: {
      title: `G${i}`,
      correct: false,
      year: { guess: null, target: null, status: "unknown" as const },
      averageScore: { guess: null, target: null, status: "unknown" as const },
      popularity: { guess: null, target: null, status: "unknown" as const },
      genres: [],
      tags: [],
      studios: [],
      source: [],
    },
  }));
  return {
    completed: false,
    round: 1,
    guesses: history.map((h) => h.guess),
    anidleHistory: history,
    attemptLimit: 20,
  };
}

function Harness({ log }: { log: (p: GameProgress) => void }) {
  const [progress, setProgress] = useState<GameProgress | undefined>(initial);
  return (
    <AnidlePage
      slug="anidle"
      mediaId={1}
      payload={payload as never}
      progress={progress}
      onProgressChange={(p) => {
        log(p);
        // Like usePuzzleProgress: identical progress keeps the same object.
        setProgress((prev) =>
          JSON.stringify(prev) === JSON.stringify(p) ? prev : p,
        );
      }}
    />
  );
}

it("keeps a revealed hint when the page feeds saved progress back in", () => {
  const log = vi.fn();
  render(<Harness log={log} />);
  expect(screen.queryByText("First clue")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /buy hint/i }));
  expect(screen.getByText("First clue")).toBeInTheDocument();
  expect(log).toHaveBeenLastCalledWith(
    expect.objectContaining({ hintsRevealed: 1 }),
  );
});
