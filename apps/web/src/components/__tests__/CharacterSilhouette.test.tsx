import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import CharacterSilhouette from "../CharacterSilhouette";
import type { CharacterSilhouetteGame } from "../../types/puzzles";

const useTitleSuggestionsMock = vi.hoisted(() => vi.fn());

vi.mock("../../hooks/useTitleSuggestions", () => ({
  useTitleSuggestions: useTitleSuggestionsMock,
}));

const verifyGuessMock = vi.hoisted(() => vi.fn());

vi.mock("../../utils/verifyGuess", () => ({
  verifyGuess: (...args: unknown[]) => verifyGuessMock(...args),
}));

describe("CharacterSilhouette autocomplete", () => {
  beforeEach(() => {
    useTitleSuggestionsMock.mockReturnValue({
      suggestions: [
        { id: 300, title: "Fullmetal Alchemist" },
        { id: 400, title: "Trigun" },
      ],
      loading: false,
      error: null,
    });
    verifyGuessMock.mockResolvedValue({ correct: true, match: "Fullmetal Alchemist" });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("lets players navigate suggestions before submitting a guess", async () => {
    const payload: CharacterSilhouetteGame = {
      spec: [
        { difficulty: 1, label: "Outline", filter: "grayscale(1)" },
        { difficulty: 2, label: "Shaded", filter: "grayscale(0.5)" },
      ],
      answer: "Fullmetal Alchemist",
      character: {
        id: 1,
        name: "Edward Elric",
        image: "",
        role: "Protagonist",
      },
    };

    const user = userEvent.setup();

    render(
      <CharacterSilhouette
        mediaId={512}
        payload={payload}
        onProgressChange={() => {}}
      />,
    );

    const input = screen.getByLabelText("Character silhouette guess");
    await user.type(input, "fu");

    const listbox = await screen.findByRole("listbox", {
      name: /character title suggestions/i,
    });
    expect(listbox).toBeInTheDocument();

    await user.keyboard("{ArrowDown}");
    const option = screen.getByRole("option", { name: "Fullmetal Alchemist" });
    expect(option).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(verifyGuessMock).toHaveBeenCalledWith(
        512,
        "Fullmetal Alchemist",
        300,
      );
    });
  });
});
