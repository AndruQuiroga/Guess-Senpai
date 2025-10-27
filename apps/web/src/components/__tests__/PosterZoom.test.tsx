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
      answer: "Naruto",
      image: null,
      cropStages: [],
      meta: { genres: [], year: 2002, format: "TV" },
    };

    const user = userEvent.setup();

    render(
      <PosterZoom
        mediaId={42}
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
      expect(verifyGuessMock).toHaveBeenCalledWith(42, "Naruto", 101);
    });
  });
});
