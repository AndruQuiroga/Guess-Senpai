import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import SynopsisRedacted from "../SynopsisRedacted";
import type { RedactedSynopsisGame } from "../../types/puzzles";

const useTitleSuggestionsMock = vi.hoisted(() => vi.fn());

vi.mock("../../hooks/useTitleSuggestions", () => ({
  useTitleSuggestions: useTitleSuggestionsMock,
}));

const verifyGuessMock = vi.hoisted(() => vi.fn());

vi.mock("../../utils/verifyGuess", () => ({
  verifyGuess: (...args: unknown[]) => verifyGuessMock(...args),
}));

describe("SynopsisRedacted autocomplete", () => {
  beforeEach(() => {
    useTitleSuggestionsMock.mockReturnValue({
      suggestions: [
        { id: 900, title: "Steins;Gate" },
        { id: 901, title: "Erased" },
      ],
      loading: false,
      error: null,
    });
    verifyGuessMock.mockResolvedValue({ correct: true, match: "Steins;Gate" });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("allows choosing a suggestion and forwards its canonical id", async () => {
    const payload: RedactedSynopsisGame = {
      spec: [{ difficulty: 1, hints: ["unmask:2"] }],
      answer: "Steins;Gate",
      text: "A genius tests a microwave...",
      masked_tokens: ["time", "machine"],
    };

    const user = userEvent.setup();

    render(
      <SynopsisRedacted
        mediaId={73}
        payload={payload}
        onProgressChange={() => {}}
      />,
    );

    const input = screen.getByLabelText("Synopsis guess");
    await user.type(input, "st");

    const listbox = await screen.findByRole("listbox", {
      name: /synopsis title suggestions/i,
    });
    expect(listbox).toBeInTheDocument();

    await user.keyboard("{ArrowDown}");
    const option = screen.getByRole("option", { name: "Steins;Gate" });
    expect(option).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(verifyGuessMock).toHaveBeenCalledWith(73, "Steins;Gate", 900);
    });
  });
});
