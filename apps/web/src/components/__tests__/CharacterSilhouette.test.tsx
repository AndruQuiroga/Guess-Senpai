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
    verifyGuessMock.mockResolvedValue({
      correct: true,
      match: "Fullmetal Alchemist",
      animeMatch: true,
      characterMatch: true,
      characterName: "Edward Elric",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("requires both anime and character guesses to clear a card", async () => {
    const payload: CharacterSilhouetteGame = {
      spec: [
        { difficulty: 1, label: "Outline", filter: "grayscale(1)" },
        { difficulty: 2, label: "Midlight", filter: "grayscale(0.6)" },
        { difficulty: 3, label: "Full reveal", filter: "none" },
      ],
      rounds: [
        {
          order: 1,
          difficulty: 1,
          entries: Array.from({ length: 4 }).map((_, index) => ({
            character: {
              id: 100 + index,
              name: index === 0 ? "Edward Elric" : `Supporting ${index}`,
              image: "https://example.com/edward.jpg",
              role: index === 0 ? "Protagonist" : null,
            },
            characterAnswer: index === 0 ? "Edward Elric" : `Supporting ${index}`,
            characterAliases: [],
            animeAnswer: "Fullmetal Alchemist",
            animeAliases: ["FMA"],
            reveal: {
              label: index === 0 ? "Outline" : `Outline ${index}`,
              filter: "grayscale(1)",
              description: "High contrast silhouette",
            },
          })),
        },
        {
          order: 2,
          difficulty: 2,
          entries: [],
        },
        {
          order: 3,
          difficulty: 3,
          entries: [],
        },
      ],
      answer: "Fullmetal Alchemist",
      character: {
        id: 1,
        name: "Edward Elric",
        image: "https://example.com/edward.jpg",
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

    const animeField = screen.getByLabelText("Anime guess for card 1");
    const characterField = screen.getAllByLabelText(/Character/)[0];

    await user.clear(animeField);
    await user.type(animeField, "Fullmetal Alchemist");
    await user.type(characterField, "Edward Elric");

    const submitButton = screen.getAllByRole("button", { name: /submit guess/i })[0];
    await user.click(submitButton);

    await waitFor(() => {
      expect(verifyGuessMock).toHaveBeenCalledWith(512, "Fullmetal Alchemist", 300, {
        characterGuess: "Edward Elric",
        characterId: 100,
      });
    });

    expect(
      await screen.findByText(/Edward Elric from Fullmetal Alchemist/i),
    ).toBeInTheDocument();
  });
});
