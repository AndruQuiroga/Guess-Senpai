import { render, screen, within } from "@testing-library/react";
import { vi } from "vitest";

import Anidle from "../Anidle";
import { AttemptMeter } from "../anidle/AttemptMeter";
import { GuessGrid } from "../anidle/GuessGrid";
import { HintStrip } from "../anidle/HintStrip";
import { listTile, scalarTile } from "../anidle/tiles";
import {
  CURRENT_ANIDLE_EVALUATION_VERSION,
  type AnidleGuessEvaluation,
} from "../../types/anidle";
import type { AnidleGame } from "../../types/puzzles";

vi.mock("../../hooks/useTitleSuggestions", () => ({
  useTitleSuggestions: () => ({
    suggestions: [],
    loading: false,
    error: null,
  }),
}));

function evaluation(
  overrides: Partial<AnidleGuessEvaluation> = {},
): AnidleGuessEvaluation {
  return {
    title: "Guess One",
    correct: false,
    year: { guess: 2010, target: 2016, status: "lower" },
    averageScore: { guess: 80, target: 82, status: "lower" },
    popularity: { guess: 500, target: 100, status: "higher" },
    genres: [
      { value: "Action", status: "match" },
      { value: "Drama", status: "miss" },
    ],
    tags: [
      { value: "A", status: "match" },
      { value: "B", status: "match" },
      { value: "C", status: "match" },
      { value: "D", status: "match" },
      { value: "E", status: "miss" },
    ],
    studios: [{ value: "Bones", status: "miss" }],
    source: [{ value: "Manga", status: "match" }],
    episodes: { guess: 12, target: 24, status: "lower" },
    format: [{ value: "TV", status: "match" }],
    ...overrides,
  };
}

describe("scalar and list tiles", () => {
  it("colours scalars and points arrows toward the answer", () => {
    expect(scalarTile("year", evaluation().year)).toMatchObject({
      tone: "wrong",
      icon: "↑",
    });
    expect(scalarTile("averageScore", evaluation().averageScore)).toMatchObject(
      { tone: "close", icon: "↑" },
    );
    expect(scalarTile("popularity", evaluation().popularity)).toMatchObject({
      tone: "wrong",
      icon: "↓",
    });
    expect(
      scalarTile("year", { guess: 2016, target: 2016, status: "match" }),
    ).toMatchObject({ tone: "correct", icon: "✓" });
    expect(
      scalarTile("year", { guess: null, target: null, status: "unknown" }),
    ).toMatchObject({ tone: "wrong", icon: "?", value: "—" });
  });

  it("derives list tone from how many items match", () => {
    expect(listTile(evaluation().genres, 3).tone).toBe("close");
    expect(listTile(evaluation().source, 1).tone).toBe("correct");
    expect(listTile(evaluation().studios, 2).tone).toBe("wrong");
    expect(listTile([], 2).tone).toBe("wrong");
  });
});

/** Body rows of the guess table (row 0 is the column header). */
const bodyRows = () => screen.getAllByRole("row").slice(1);

/** Chip values in a cell, prefixed with their ✓/✗ marker. */
const chips = (cell: HTMLElement) =>
  Array.from(cell.querySelectorAll("li")).map((item) =>
    item.textContent?.replace(/^([✓✗])/, "$1 "),
  );

describe("episodes and format columns", () => {
  it("points the episodes arrow toward the answer and tones closeness", () => {
    expect(scalarTile("episodes", evaluation().episodes!)).toMatchObject({
      tone: "wrong",
      icon: "↑",
      value: "12",
    });
    expect(
      scalarTile("episodes", { guess: 22, target: 24, status: "lower" }),
    ).toMatchObject({ tone: "close", icon: "↑" });
    expect(
      scalarTile("episodes", { guess: 24, target: 24, status: "match" }),
    ).toMatchObject({ tone: "correct", icon: "✓" });
  });

  it("scores format as correct or wrong", () => {
    expect(listTile(evaluation().format!, 1).tone).toBe("correct");
    expect(listTile([{ value: "Movie", status: "miss" }], 1).tone).toBe(
      "wrong",
    );
  });

  it("renders the cells, the wrong format value and the cover thumbnail", () => {
    render(
      <GuessGrid
        evaluations={[
          evaluation({
            format: [{ value: "Movie", status: "miss" }],
            coverImage: "https://img.example/cover.jpg",
          }),
        ]}
      />,
    );
    const row = bodyRows()[0];
    expect(within(row).getAllByRole("cell")).toHaveLength(9);
    expect(
      within(row).getByText("Episodes 12: the answer is higher"),
    ).toBeInTheDocument();
    expect(within(row).getByText("Movie")).toBeInTheDocument();
    expect(within(row).getByText("Format: 0 of 1 match")).toBeInTheDocument();
    const cover = row.querySelector("img");
    expect(cover).toHaveAttribute("src", "https://img.example/cover.jpg");
    const header = screen.getAllByRole("row")[0];
    expect(
      within(header).getByRole("columnheader", { name: "Episodes" }),
    ).toBeInTheDocument();
    expect(
      within(header).getByRole("columnheader", { name: "Format" }),
    ).toBeInTheDocument();
  });

  it("shows a no-data tile for guesses saved before the new columns existed", () => {
    render(
      <GuessGrid
        evaluations={[evaluation({ episodes: undefined, format: undefined })]}
      />,
    );
    const row = bodyRows()[0];
    expect(within(row).getByText("Episodes: no data")).toBeInTheDocument();
    expect(within(row).getByText("Format: No data")).toBeInTheDocument();
  });
});

describe("GuessGrid", () => {
  it("lists the newest guess first with tone, arrows and an sr-only label", () => {
    render(
      <GuessGrid
        evaluations={[
          evaluation({ title: "First" }),
          evaluation({ title: "Second" }),
        ]}
      />,
    );
    const rows = bodyRows();
    expect(rows[0]).toHaveTextContent("Second");
    expect(rows[1]).toHaveTextContent("First");
    const cells = within(rows[0]).getAllByRole("cell");
    expect(cells[0]).toHaveAttribute("data-tone", "wrong");
    expect(cells[0]).toHaveTextContent("↑");
    expect(cells[0]).toHaveTextContent("the answer is higher");
    expect(cells[1]).toHaveAttribute("data-tone", "close");
    expect(cells[2]).toHaveTextContent("↓");
    expect(screen.queryByText(/no match/i)).toBeNull();
    expect(screen.getByRole("list", { name: "Legend" })).toBeInTheDocument();
  });

  it("lists genres in full and folds long tag lists, one column each", () => {
    render(<GuessGrid evaluations={[evaluation()]} />);
    const cells = within(bodyRows()[0]).getAllByRole("cell");
    // Year, Score, Popularity, Episodes, Format, Source, Genres, Tags, Studio.
    expect(chips(cells[6])).toEqual(["✓ Action", "✗ Drama"]);
    // Tags show three and fold the rest; the sr-only sentence lists them all.
    expect(chips(cells[7])).toEqual(["✓ A", "✓ B", "✓ C", "+2"]);
    expect(cells[7]).toHaveTextContent("Tags: 4 of 5 match: A, B, C, D");
    expect(chips(cells[8])).toEqual(["✗ Bones"]);
  });

  it("keeps the studio column to two entries", () => {
    render(
      <GuessGrid
        evaluations={[
          evaluation({
            studios: [
              { value: "MAPPA", status: "match" },
              { value: "Aniplex", status: "miss" },
              { value: "Toho", status: "miss" },
              { value: "Dentsu", status: "miss" },
            ],
          }),
        ]}
      />,
    );
    const studio = within(bodyRows()[0]).getAllByRole("cell")[8];
    expect(chips(studio)).toEqual(["✓ MAPPA", "✗ Aniplex", "+2"]);
    expect(studio).toHaveTextContent("Studio: 1 of 4 match: MAPPA");
  });

  it("only animates the freshly added row", () => {
    const { container } = render(
      <GuessGrid
        evaluations={[evaluation(), evaluation({ title: "Newest" })]}
        animateIndex={1}
      />,
    );
    const rows = container.querySelectorAll("tbody tr");
    expect(rows[0].querySelectorAll(".anidle-reveal").length).toBeGreaterThan(
      0,
    );
    expect(rows[1].querySelectorAll(".anidle-reveal")).toHaveLength(0);
  });
});

describe("AttemptMeter", () => {
  it("marks used pips and the hint thresholds", () => {
    const { container } = render(
      <AttemptMeter used={3} max={8} hintAfter={[2, 4, 6]} />,
    );
    expect(screen.getByText("Guess 4 / 8")).toBeInTheDocument();
    const pips = container.querySelectorAll("[data-pip]");
    expect(pips).toHaveLength(8);
    expect(container.querySelectorAll('[data-pip="used"]')).toHaveLength(3);
    const marked = Array.from(pips)
      .map((pip, index) => (pip.hasAttribute("data-hint") ? index + 1 : null))
      .filter(Boolean);
    expect(marked).toEqual([2, 4, 6]);
  });
});

describe("HintStrip", () => {
  it("renders redacted words as labelled bars", () => {
    render(
      <HintStrip
        hints={[
          {
            type: "synopsis",
            label: "Synopsis hint",
            ratio: 0.2,
            text: "A [REDACTED] who fights [REDACTED] daily.",
          },
        ]}
      />,
    );
    expect(screen.getAllByRole("img", { name: "redacted" })).toHaveLength(2);
    expect(screen.queryByText(/\[REDACTED\]/)).toBeNull();
  });
});

describe("Anidle empty state", () => {
  const payload: AnidleGame = {
    rules: { version: "2", max_attempts: 8, hint_after_incorrect: [2, 4, 6] },
    spec: [{ difficulty: 1, hints: [] }],
    answer: "Answer",
    hints: {
      genres: ["Action"],
      tags: [],
      synopsis: [{ ratio: 0.2, text: "Clue [REDACTED] text" }],
    },
  };

  it("shows only the prompt, input and button before any guess", () => {
    render(<Anidle mediaId={3} payload={payload} onProgressChange={vi.fn()} />);
    expect(screen.getByText("Enter a first guess to start")).toBeVisible();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Submit Guess" }),
    ).toHaveTextContent("Guess");
    expect(screen.queryByRole("region", { name: "Hints" })).toBeNull();
    expect(screen.queryByText(/Clue/)).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByText(/How to play/)).toBeNull();
  });

  it("hides the prompt and shows the grid and a redaction-bar hint once guesses exist", () => {
    const history = [0, 1].map((i) => ({
      guess: `G${i}`,
      guessMediaId: i + 1,
      evaluation: evaluation({ title: `G${i}` }),
      evaluationVersion: CURRENT_ANIDLE_EVALUATION_VERSION,
    }));
    render(
      <Anidle
        mediaId={3}
        payload={payload}
        onProgressChange={vi.fn()}
        initialProgress={{
          completed: false,
          round: 1,
          guesses: ["G0", "G1"],
          anidleHistory: history,
          anidleHints: ["synopsis"],
        }}
      />,
    );
    expect(screen.queryByText("Enter a first guess to start")).toBeNull();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Hints" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "redacted" })).toBeInTheDocument();
  });
});
