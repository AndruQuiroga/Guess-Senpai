import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import CharacterSilhouette, { CLARITY_FILTERS } from "../CharacterSilhouette";
import type { GameProgress } from "../../types/progress";
import type {
  CharacterGuessEntry,
  CharacterSilhouetteGame,
} from "../../types/puzzles";

vi.mock("../../hooks/useTitleSuggestions", () => ({
  useTitleSuggestions: () => ({ suggestions: [], loading: false, error: null }),
}));

const verifyGuessMock = vi.hoisted(() => vi.fn());
vi.mock("../../utils/verifyGuess", () => ({
  verifyGuess: (...args: unknown[]) => verifyGuessMock(...args),
}));

function card(
  id: number,
  name: string,
  anime: string,
  mediaId: number,
): CharacterGuessEntry {
  return {
    character: {
      id,
      name,
      image: `https://img.example/c${id}.jpg`,
      role: "Main",
    },
    characterAnswer: name,
    characterAliases: [name],
    animeAnswer: anime,
    animeAliases: [anime],
    reveal: { label: "Easy", filter: "none" },
    mediaId,
  };
}

const payload: CharacterSilhouetteGame = {
  spec: [],
  answer: "Code Geass",
  character: { id: 1, name: "Lelouch", image: "x" },
  rounds: [
    {
      order: 1,
      difficulty: 1,
      entries: [
        card(1, "Lelouch", "Code Geass", 100),
        card(2, "Edward Elric", "FMA", 200),
      ],
    },
    {
      order: 2,
      difficulty: 2,
      entries: [
        card(3, "Saitama", "One-Punch Man", 300),
        card(4, "Yato", "Noragami", 400),
      ],
    },
  ],
};

describe("CharacterSilhouette check-all rounds", () => {
  afterEach(() => vi.clearAllMocks());

  it("starts on round 1 with every card shadowed, not revealed", () => {
    render(
      <CharacterSilhouette
        payload={payload}
        mediaId={100}
        onProgressChange={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Round 1 · Easy/ }),
    ).toHaveAttribute("aria-current", "step");
    const images = screen.getAllByAltText(/obscured/) as HTMLImageElement[];
    expect(images).toHaveLength(2);
    images.forEach((image) =>
      expect(image.style.filter).toBe(CLARITY_FILTERS[0]),
    );
  });

  it("sharpens one card for a cost", () => {
    const progress = vi.fn();
    render(
      <CharacterSilhouette
        payload={payload}
        mediaId={100}
        onProgressChange={progress}
      />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: /Sharpen/ })[1]);
    const images = screen.getAllByAltText(/obscured/) as HTMLImageElement[];
    expect(images[0].style.filter).toBe(CLARITY_FILTERS[0]);
    expect(images[1].style.filter).toBe(CLARITY_FILTERS[1]);
    expect(progress.mock.calls.at(-1)?.[0].rounds[0]).toMatchObject({
      hints: 1,
      answers: { cardHints: { 1: 1 } },
    });
  });

  it("checks every card against its own character and anime", async () => {
    verifyGuessMock.mockImplementation(
      async (
        mediaId: number,
        anime: string,
        _id: unknown,
        options: { characterGuess?: string },
      ) => ({
        correct: false,
        animeMatch: mediaId === 100 && anime === "Code Geass",
        characterMatch: options.characterGuess
          ? options.characterGuess === "Lelouch"
          : null,
      }),
    );
    const progress = vi.fn();
    render(
      <CharacterSilhouette
        payload={payload}
        mediaId={100}
        onProgressChange={progress}
      />,
    );

    const names = screen.getAllByRole("combobox", { name: "Character name" });
    const animes = screen.getAllByRole("combobox", { name: "Anime title" });
    fireEvent.change(names[0], { target: { value: "Lelouch" } });
    fireEvent.change(animes[0], { target: { value: "Code Geass" } });
    fireEvent.change(names[1], { target: { value: "Wrong Name" } });
    fireEvent.click(screen.getByRole("button", { name: "Check all" }));

    // Card 1 fully right (500 of 500), card 2 wrong.
    expect(await screen.findByText("+500")).toBeInTheDocument();
    expect(verifyGuessMock).toHaveBeenCalledWith(100, "Code Geass", undefined, {
      characterGuess: "Lelouch",
      characterId: null,
      targetCharacterId: 1,
    });
    expect(verifyGuessMock).toHaveBeenCalledWith(200, "", undefined, {
      characterGuess: "Wrong Name",
      characterId: null,
      targetCharacterId: 2,
    });
    // Revealed art on the results screen.
    expect(screen.getByAltText("Edward Elric")).toBeInTheDocument();
    const last = progress.mock.calls.at(-1)?.[0] as GameProgress;
    expect(last.rounds?.[0]).toMatchObject({ completed: true, points: 500 });
  });

  it("refuses to check an empty lineup", async () => {
    render(
      <CharacterSilhouette
        payload={payload}
        mediaId={100}
        onProgressChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Check all" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "at least one card",
    );
    expect(verifyGuessMock).not.toHaveBeenCalled();
  });
});
