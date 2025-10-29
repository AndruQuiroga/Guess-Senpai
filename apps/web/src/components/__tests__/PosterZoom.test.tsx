import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import PosterZoom from "../PosterZoom";
import type { PosterZoomGame } from "../../types/puzzles";

const useTitleSuggestionsMock = vi.hoisted(() => vi.fn());

vi.mock("../../hooks/useTitleSuggestions", () => ({
  useTitleSuggestions: useTitleSuggestionsMock,
}));

const verifyGuessMock = vi.hoisted(() => vi.fn());

vi.mock("../../utils/verifyGuess", () => ({
  verifyGuess: (...args: unknown[]) => verifyGuessMock(...args),
}));

describe("PosterZoom autocomplete", () => {
  beforeEach(() => {
    useTitleSuggestionsMock.mockReturnValue({
      suggestions: [
        { id: 101, title: "Naruto" },
        { id: 202, title: "Bleach" },
      ],
      loading: false,
      error: null,
    });
    verifyGuessMock.mockResolvedValue({ correct: true, match: "Naruto" });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("opens suggestions and submits the selected canonical title", async () => {
    const payload: PosterZoomGame = {
      spec: [{ difficulty: 1, hints: [] }],
      rounds: [
        {
          order: 1,
          difficulty: 1,
          mediaId: 42,
          answer: "Naruto",
          meta: { genres: [], year: 2002, format: "TV" },
          cropStages: [],
        },
      ],
    };

    const user = userEvent.setup();

    render(
      <PosterZoom
        payload={payload}
        onProgressChange={() => {}}
      />, 
    );

    const input = screen.getByLabelText("Poster Zoom guess");
    await user.type(input, "na");

    const listbox = await screen.findByRole("listbox", {
      name: /poster title suggestions/i,
    });
    expect(listbox).toBeInTheDocument();

    await user.keyboard("{ArrowDown}");
    const option = screen.getByRole("option", { name: "Naruto" });
    expect(option).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(verifyGuessMock).toHaveBeenCalledWith(42, "Naruto", 101, {
        season: undefined,
        seasonYear: undefined,
      });
    });
  });

  it("emits enriched progress metadata for each round", async () => {
    const payload: PosterZoomGame = {
      spec: [{ difficulty: 1, hints: [] }],
      rounds: [
        {
          order: 1,
          difficulty: 1,
          mediaId: 88,
          answer: "Bleach",
          meta: { genres: [], year: 2004, format: "TV" },
          cropStages: [],
        },
      ],
    };

    const onProgressChange = vi.fn();

    render(
      <PosterZoom
        payload={payload}
        onProgressChange={onProgressChange}
      />,
    );

    await waitFor(() => {
      expect(onProgressChange).toHaveBeenCalled();
    });

    const progressArg = onProgressChange.mock.calls.at(-1)?.[0];
    expect(progressArg).toBeTruthy();
    expect(progressArg.rounds).toBeTruthy();
    const [firstRound] = progressArg.rounds;
    expect(firstRound).toMatchObject({
      round: 1,
      mediaId: 88,
      posterImageBase: "http://localhost:8000/puzzles/poster/88/image",
      posterImageUrl: "http://localhost:8000/puzzles/poster/88/image?hints=0",
      stage: 1,
      completed: false,
    });
    expect(firstRound.feedbackType).toBeUndefined();
    expect(firstRound.seasonGuess).toBeUndefined();
  });
});
