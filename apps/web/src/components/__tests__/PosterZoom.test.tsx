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

describe("PosterZoom rounds", () => {
  beforeEach(() => {
    useTitleSuggestionsMock.mockReturnValue({
      suggestions: [
        { id: 101, title: "Naruto" },
        { id: 202, title: "Bleach" },
        { id: 303, title: "Wrong Guess" },
        { id: 404, title: "One Piece" },
      ],
      loading: false,
      error: null,
    });
    verifyGuessMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("steps through every round and submits combined season/year guesses", async () => {
    verifyGuessMock
      .mockResolvedValueOnce({ correct: true, anime_match: true, match: "Naruto" })
      .mockResolvedValueOnce({ correct: false, anime_match: false })
      .mockResolvedValueOnce({ correct: true, anime_match: true, match: "Bleach" })
      .mockResolvedValueOnce({
        correct: true,
        anime_match: true,
        match: "One Piece",
        seasonMatch: true,
        seasonYearMatch: true,
      });

    const payload: PosterZoomGame = {
      spec: [
        { difficulty: 1, hints: ["genres", "season", "format"] },
        { difficulty: 2, hints: ["genres", "year"] },
        { difficulty: 3, hints: ["genres"] },
      ],
      rounds: [
        {
          order: 1,
          difficulty: 1,
          mediaId: 11,
          answer: "Naruto",
          meta: { genres: ["Action"], year: 2002, season: "Spring", format: "TV" },
          cropStages: [],
        },
        {
          order: 2,
          difficulty: 2,
          mediaId: 22,
          answer: "Bleach",
          meta: { genres: ["Action"], year: 2004, season: "Fall", format: "TV" },
          cropStages: [],
        },
        {
          order: 3,
          difficulty: 3,
          mediaId: 33,
          answer: "One Piece",
          meta: { genres: ["Adventure"], year: 2010, season: "Spring", format: "TV" },
          cropStages: [],
        },
      ],
    };

    const onProgressChange = vi.fn();
    const user = userEvent.setup();

    render(
      <PosterZoom
        payload={payload}
        onProgressChange={onProgressChange}
      />,
    );

    const input = screen.getByLabelText("Poster Zoom guess");
    const submitButton = screen.getByRole("button", { name: /submit guess/i });
    const seasonSelect = screen.getByLabelText("Release season");
    const yearInput = screen.getByLabelText("Release year");
    const round2Button = screen.getByRole("button", { name: "Round 2" });
    const round3Button = screen.getByRole("button", { name: "Round 3" });

    expect(round2Button).toBeDisabled();
    expect(round3Button).toBeDisabled();

    await user.type(input, "Naruto");
    await user.click(submitButton);

    await waitFor(() => {
      expect(verifyGuessMock).toHaveBeenCalledTimes(1);
    });
    expect(verifyGuessMock).toHaveBeenNthCalledWith(1, 11, "Naruto", 101, {
      season: undefined,
      seasonYear: undefined,
    });
    expect(round2Button).not.toBeDisabled();
    const afterRoundOne = onProgressChange.mock.calls.at(-1)?.[0];
    expect(afterRoundOne.round).toBe(2);
    expect(afterRoundOne.rounds?.[0]).toMatchObject({
      round: 1,
      completed: true,
      guesses: ["Naruto"],
      feedbackType: "success",
    });

    await user.clear(input);
    await user.type(input, "Wrong Guess");
    await user.click(submitButton);

    await waitFor(() => {
      expect(verifyGuessMock).toHaveBeenCalledTimes(2);
    });
    expect(verifyGuessMock).toHaveBeenNthCalledWith(2, 22, "Wrong Guess", 303, {
      season: undefined,
      seasonYear: undefined,
    });
    await screen.findByText("Not quite. Keep trying!");
    const afterMiss = onProgressChange.mock.calls.at(-1)?.[0];
    expect(afterMiss.rounds?.[1]).toMatchObject({
      round: 2,
      completed: false,
      stage: 2,
      guesses: ["Wrong Guess"],
    });

    await user.clear(input);
    await user.type(input, "Bleach");
    await user.click(submitButton);

    await waitFor(() => {
      expect(verifyGuessMock).toHaveBeenCalledTimes(3);
    });
    expect(verifyGuessMock).toHaveBeenNthCalledWith(3, 22, "Bleach", 202, {
      season: undefined,
      seasonYear: undefined,
    });
    expect(round3Button).not.toBeDisabled();
    const afterRoundTwo = onProgressChange.mock.calls.at(-1)?.[0];
    expect(afterRoundTwo.round).toBe(3);
    expect(afterRoundTwo.rounds?.[1]).toMatchObject({
      round: 2,
      completed: true,
      feedbackType: "success",
    });
    expect(afterRoundTwo.rounds?.[1]?.guesses).toEqual([
      "Wrong Guess",
      "Bleach",
    ]);

    await user.selectOptions(seasonSelect, "Spring");
    await user.clear(yearInput);
    await user.type(yearInput, "2010");
    await user.clear(input);
    await user.type(input, "One Piece");
    await user.click(submitButton);

    await waitFor(() => {
      expect(verifyGuessMock).toHaveBeenCalledTimes(4);
    });
    expect(verifyGuessMock).toHaveBeenNthCalledWith(4, 33, "One Piece", 404, {
      season: "SPRING",
      seasonYear: 2010,
    });
    const finalProgress = onProgressChange.mock.calls.at(-1)?.[0];
    expect(finalProgress.completed).toBe(true);
    expect(finalProgress.rounds?.map((round) => round?.completed)).toEqual([
      true,
      true,
      true,
    ]);
    const lastRound = finalProgress.rounds?.[2];
    expect(lastRound).toMatchObject({
      round: 3,
      guesses: ["One Piece"],
      seasonGuess: "SPRING",
      seasonYearGuess: 2010,
      feedbackType: "success",
    });
  });

  it("restores persisted progress across rounds", async () => {
    verifyGuessMock.mockResolvedValueOnce({
      correct: true,
      anime_match: true,
      match: "One Piece",
    });

    const payload: PosterZoomGame = {
      spec: [
        { difficulty: 1, hints: ["genres", "season", "format"] },
        { difficulty: 2, hints: ["genres", "year"] },
        { difficulty: 3, hints: ["genres"] },
      ],
      rounds: [
        {
          order: 1,
          difficulty: 1,
          mediaId: 11,
          answer: "Naruto",
          meta: { genres: ["Action"], year: 2002, season: "Spring", format: "TV" },
          cropStages: [],
        },
        {
          order: 2,
          difficulty: 2,
          mediaId: 22,
          answer: "Bleach",
          meta: { genres: ["Action"], year: 2004, season: "Fall", format: "TV" },
          cropStages: [],
        },
        {
          order: 3,
          difficulty: 3,
          mediaId: 33,
          answer: "One Piece",
          meta: { genres: ["Adventure"], year: 2010, season: "Spring", format: "TV" },
          cropStages: [],
        },
      ],
    };

    const initialProgress = {
      completed: false,
      round: 3,
      guesses: ["Naruto", "Bleach"],
      rounds: [
        {
          round: 1,
          guesses: ["Naruto"],
          titleGuesses: ["Naruto"],
          yearGuesses: [2002],
          stage: 3,
          completed: true,
          hintUsed: true,
          resolvedTitle: "Naruto",
          resolvedYear: 2002,
          seasonGuess: "SPRING",
          seasonYearGuess: 2002,
          mediaId: 11,
          posterImageBase: "http://localhost:8000/puzzles/poster/11/image",
          posterImageUrl: "http://localhost:8000/puzzles/poster/11/image?hints=2",
          feedbackType: "success",
          feedbackMessage: "Poster solved! Naruto",
        },
        {
          round: 2,
          guesses: ["Bleach"],
          titleGuesses: ["Bleach"],
          stage: 3,
          completed: true,
          hintUsed: true,
          resolvedTitle: "Bleach",
          mediaId: 22,
          posterImageBase: "http://localhost:8000/puzzles/poster/22/image",
          posterImageUrl: "http://localhost:8000/puzzles/poster/22/image?hints=2",
          feedbackType: "success",
          feedbackMessage: "Poster solved! Bleach",
        },
        {
          round: 3,
          guesses: ["One Piece"],
          titleGuesses: ["One Piece"],
          yearGuesses: [2010],
          stage: 2,
          completed: false,
          hintUsed: true,
          seasonGuess: "SPRING",
          seasonYearGuess: 2010,
          feedbackType: "partial",
          feedbackMessage: "Title correct! Check the release year.",
          resolvedTitle: "One Piece",
          mediaId: 33,
          posterImageBase: "http://localhost:8000/puzzles/poster/33/image",
          posterImageUrl: "http://localhost:8000/puzzles/poster/33/image?hints=1",
        },
      ],
    };

    const onProgressChange = vi.fn();
    const user = userEvent.setup();

    render(
      <PosterZoom
        payload={payload}
        initialProgress={initialProgress}
        onProgressChange={onProgressChange}
      />,
    );

    await waitFor(() => {
      expect(onProgressChange).toHaveBeenCalled();
    });

    const hydrated = onProgressChange.mock.calls.at(-1)?.[0];
    expect(hydrated.round).toBe(3);
    expect(hydrated.rounds?.[0]).toMatchObject({
      round: 1,
      completed: true,
      guesses: ["Naruto"],
    });
    expect(hydrated.rounds?.[1]).toMatchObject({
      round: 2,
      completed: true,
      guesses: ["Bleach"],
    });
    expect(hydrated.rounds?.[2]).toMatchObject({
      round: 3,
      stage: 2,
      feedbackType: "partial",
      seasonGuess: "SPRING",
      seasonYearGuess: 2010,
    });

    const input = screen.getByLabelText("Poster Zoom guess");
    const seasonSelect = screen.getByLabelText("Release season");
    const yearInput = screen.getByLabelText("Release year");
    expect(input).toHaveValue("One Piece");
    expect(seasonSelect).toHaveValue("Spring");
    expect(yearInput).toHaveValue("2010");

    await user.click(screen.getByRole("button", { name: /submit guess/i }));

    await waitFor(() => {
      expect(verifyGuessMock).toHaveBeenCalledTimes(1);
    });
    expect(verifyGuessMock).toHaveBeenCalledWith(33, "One Piece", 404, {
      season: "SPRING",
      seasonYear: 2010,
    });

    const completed = onProgressChange.mock.calls.at(-1)?.[0];
    expect(completed.completed).toBe(true);
    expect(completed.rounds?.[2]).toMatchObject({
      completed: true,
      seasonGuess: "SPRING",
      seasonYearGuess: 2010,
    });
  });
});
