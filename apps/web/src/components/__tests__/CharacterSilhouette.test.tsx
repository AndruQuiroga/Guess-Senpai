import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import CharacterSilhouette from "../CharacterSilhouette";
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
    const art = screen.getAllByRole("img", { name: /obscured/ });
    expect(art).toHaveLength(2);
    art.forEach((card) => {
      expect(card).toHaveAttribute("data-art", "shadow");
      expect(card).toHaveAttribute("data-level", "0");
    });
    expect(screen.queryByAltText("Lelouch")).toBeNull();
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
    const art = screen.getAllByRole("img", { name: /obscured/ });
    expect(art[0]).toHaveAttribute("data-level", "0");
    expect(art[1]).toHaveAttribute("data-level", "1");
    expect(progress.mock.calls.at(-1)?.[0].rounds[0]).toMatchObject({
      hints: 1,
      answers: { cardHints: { 1: 1 } },
    });
  });

  it("mixes close-up, mosaic and scrambled tiles in a Hard round", () => {
    const hard: CharacterSilhouetteGame = {
      ...payload,
      rounds: [
        {
          order: 1,
          difficulty: 3,
          entries: [
            card(5, "A", "Show A", 500),
            card(6, "B", "Show B", 600),
            card(7, "C", "Show C", 700),
            card(8, "D", "Show D", 800),
          ],
        },
      ],
    };
    render(
      <CharacterSilhouette
        payload={hard}
        mediaId={500}
        onProgressChange={vi.fn()}
      />,
    );
    const art = screen.getAllByRole("img", { name: /obscured/ });
    expect(art.map((item) => item.getAttribute("data-art"))).toEqual([
      "crop",
      "mosaic",
      "tiles",
      "crop",
    ]);
    // Close-up: a zoomed slice; mosaic: a canvas; tiles: nine, none in place.
    expect(art[0].querySelector("img")?.style.transform).toBe("scale(2.6)");
    expect(art[1].querySelector("canvas")).not.toBeNull();
    const tiles = art[2].querySelectorAll("[data-tile]");
    expect(tiles).toHaveLength(9);
    expect(art[2].querySelectorAll('[data-in-place="true"]')).toHaveLength(0);
    expect(screen.getByText(/#1 · Close-up/)).toBeInTheDocument();

    // Each Sharpen puts three more tiles back.
    fireEvent.click(screen.getAllByRole("button", { name: /Sharpen/ })[2]);
    expect(
      screen
        .getAllByRole("img", { name: /obscured/ })[2]
        .querySelectorAll('[data-in-place="true"]').length,
    ).toBeGreaterThanOrEqual(3);
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
    // Results sit under each card instead of a table above them.
    expect(screen.queryByRole("table")).toBeNull();
    const second = screen.getByAltText("Edward Elric").closest("li")!;
    expect(second).toHaveTextContent("Wrong Name");
    expect(second).toHaveTextContent("Answer: Edward Elric");
    expect(second).toHaveTextContent("Wrong: Wrong Name");
    const first = screen.getByAltText("Lelouch").closest("li")!;
    expect(first).toHaveTextContent("Correct: Lelouch");
    expect(first).toHaveTextContent("Correct: Code Geass");
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
