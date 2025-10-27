import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import GuessOpening from "../GuessOpening";
import type { GuessOpeningRound } from "../../types/puzzles";

const useTitleSuggestionsMock = vi.hoisted(() => vi.fn());

vi.mock("../../hooks/useTitleSuggestions", () => ({
  useTitleSuggestions: useTitleSuggestionsMock,
}));

const verifyGuessMock = vi.hoisted(() => vi.fn());

vi.mock("../../utils/verifyGuess", () => ({
  verifyGuess: (...args: unknown[]) => verifyGuessMock(...args),
}));

describe("GuessOpening autocomplete", () => {
  beforeEach(() => {
    useTitleSuggestionsMock.mockReturnValue({
      suggestions: [
        { id: 55, title: "Neon Genesis Evangelion" },
        { id: 77, title: "Cowboy Bebop" },
      ],
      loading: false,
      error: null,
    });
    verifyGuessMock.mockResolvedValue({
      correct: true,
      match: "Neon Genesis Evangelion",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("submits the highlighted suggestion when confirming with enter", async () => {
    const payload: GuessOpeningRound = {
      order: 1,
      mediaId: 84,
      spec: [{ difficulty: 1, hints: [] }],
      answer: "Neon Genesis Evangelion",
      clip: {
        audioUrl: null,
        videoUrl: null,
        mimeType: null,
        lengthSeconds: 90,
      },
      meta: { artist: null, songTitle: null, sequence: 1, season: null },
      solution: {
        titles: { english: "Neon Genesis Evangelion" },
        coverImage: null,
        synopsis: null,
        aniListUrl: "https://anilist.co/anime/84",
        streamingLinks: [],
      },
    };

    const user = userEvent.setup();

    render(<GuessOpening payload={[payload]} onProgressChange={() => {}} />);

    const input = screen.getByLabelText("Guess the opening");
    await user.type(input, "ne");

    const listbox = await screen.findByRole("listbox", {
      name: /opening title suggestions/i,
    });
    expect(listbox).toBeInTheDocument();

    await user.keyboard("{ArrowDown}");
    const option = screen.getByRole("option", {
      name: "Neon Genesis Evangelion",
    });
    expect(option).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(verifyGuessMock).toHaveBeenCalledWith(
        84,
        "Neon Genesis Evangelion",
        55,
      );
    });
  });
});
