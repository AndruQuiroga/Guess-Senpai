import { render, screen, within } from "@testing-library/react";

import { KnowledgeSummary } from "../anidle/KnowledgeSummary";
import { summarizeEvaluations } from "../anidle/summary";
import type { AnidleGuessEvaluation } from "../../types/anidle";

function guess(
  overrides: Partial<AnidleGuessEvaluation> = {},
): AnidleGuessEvaluation {
  return {
    title: "Guess",
    correct: false,
    year: { guess: null, target: null, status: "unknown" },
    averageScore: { guess: null, target: null, status: "unknown" },
    popularity: { guess: null, target: null, status: "unknown" },
    genres: [],
    tags: [],
    studios: [],
    source: [],
    ...overrides,
  };
}

describe("summarizeEvaluations", () => {
  it("narrows numeric ranges from every guess", () => {
    const knowledge = summarizeEvaluations([
      // "lower" means the guess was below the answer.
      guess({ year: { guess: 2010, target: null, status: "lower" } }),
      guess({ year: { guess: 2016, target: null, status: "higher" } }),
      guess({ year: { guess: 2012, target: null, status: "lower" } }),
      guess({ averageScore: { guess: 70, target: null, status: "lower" } }),
      guess({ popularity: { guess: 300000, target: null, status: "higher" } }),
      guess({ episodes: { guess: 12, target: 12, status: "match" } }),
    ]);
    const byKey = Object.fromEntries(
      knowledge.scalars.map((item) => [item.key, item]),
    );
    expect(byKey.year.text).toBe("2013–2015");
    expect(byKey.averageScore.text).toBe("≥ 71%");
    expect(byKey.popularity.text).toBe("< 300k");
    expect(byKey.episodes).toMatchObject({ text: "12", exact: true });
  });

  it("collapses a range to one value once the bounds meet", () => {
    const knowledge = summarizeEvaluations([
      guess({ year: { guess: 2015, target: null, status: "lower" } }),
      guess({ year: { guess: 2017, target: null, status: "higher" } }),
    ]);
    expect(knowledge.scalars[0]).toMatchObject({ text: "2016", exact: true });
  });

  it("separates confirmed and ruled-out list values", () => {
    const knowledge = summarizeEvaluations([
      guess({
        genres: [
          { value: "Action", status: "match" },
          { value: "Drama", status: "miss" },
        ],
      }),
      guess({
        genres: [
          { value: "action", status: "match" },
          { value: "Romance", status: "miss" },
        ],
      }),
      null,
    ]);
    const genres = knowledge.lists.find((item) => item.key === "genres");
    expect(genres?.confirmed).toEqual(["action"]);
    expect(genres?.excluded).toEqual(["Drama", "Romance"]);
  });
});

describe("KnowledgeSummary", () => {
  it("renders nothing before the first guess", () => {
    const { container } = render(<KnowledgeSummary evaluations={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows ranges, confirmed values and ruled-out values", () => {
    render(
      <KnowledgeSummary
        evaluations={[
          guess({
            year: { guess: 2010, target: null, status: "lower" },
            genres: [
              { value: "Action", status: "match" },
              { value: "Drama", status: "miss" },
            ],
          }),
        ]}
      />,
    );
    const region = screen.getByRole("region", { name: "What you know" });
    expect(within(region).getByText("≥ 2011")).toBeInTheDocument();
    expect(within(region).getByText("✓ Action")).toBeInTheDocument();
    expect(within(region).getByText("Drama")).toBeInTheDocument();
  });
});
