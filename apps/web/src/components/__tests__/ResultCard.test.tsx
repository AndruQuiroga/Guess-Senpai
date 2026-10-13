import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { ResultCard, buildShareText } from "../anidle/ResultCard";
import { normalizeAnidleEvaluation } from "../../utils/normalizeAnidleEvaluation";

describe("ResultCard", () => {
  const base = {
    solved: true,
    answer: "Mob Psycho 100",
    attempts: 3,
    maxAttempts: 8,
    evaluations: [],
  };

  it("keeps the daily link and share copy by default", () => {
    render(<ResultCard {...base} nextSlug="poster-zoomed" />);
    expect(screen.getByRole("link", { name: /Next puzzle/ })).toHaveAttribute(
      "href",
      "/games/poster-zoomed",
    );
    expect(screen.queryByRole("button", { name: /New puzzle/ })).toBeNull();
    expect(buildShareText(true, 3, 8)).toContain("today's Anidle");
  });

  it("offers New puzzle instead of the daily link for practice", async () => {
    const onNewPuzzle = vi.fn();
    render(
      <ResultCard
        {...base}
        onNewPuzzle={onNewPuzzle}
        coverImage="https://img.example/cover.jpg"
      />,
    );
    expect(screen.queryByRole("link", { name: /Back to Today/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /New puzzle/ }));
    expect(onNewPuzzle).toHaveBeenCalledTimes(1);
    expect(document.querySelector("img")).toHaveAttribute(
      "src",
      "https://img.example/cover.jpg",
    );
    expect(buildShareText(true, 3, 8, true)).not.toMatch(/today/i);
    expect(buildShareText(false, 8, 8, true)).toContain("Unlimited Anidle");
  });
});

describe("normalizeAnidleEvaluation", () => {
  it("keeps episodes, format and cover when present and omits them otherwise", () => {
    const withExtras = normalizeAnidleEvaluation({
      title: "A",
      correct: false,
      episodes: { guess: 12, target: 24, status: "lower" },
      format: [{ value: "TV", status: "match" }],
      cover_image: "https://img.example/a.jpg",
    });
    expect(withExtras?.episodes).toMatchObject({ guess: 12, status: "lower" });
    expect(withExtras?.format).toEqual([{ value: "TV", status: "match" }]);
    expect(withExtras?.coverImage).toBe("https://img.example/a.jpg");

    const legacy = normalizeAnidleEvaluation({ title: "B", correct: false });
    expect(legacy).not.toHaveProperty("episodes");
    expect(legacy).not.toHaveProperty("format");
    expect(legacy).not.toHaveProperty("coverImage");
  });
});
