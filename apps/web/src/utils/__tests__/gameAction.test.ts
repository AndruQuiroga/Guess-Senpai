import {
  getGameAction,
  getGameOutcome,
  getGameStatusLabel,
  isProgressExhausted,
} from "../gameAction";

describe("daily game actions", () => {
  it("shows Play for a new guest with no saved progress", () => {
    expect(getGameAction(undefined)).toBe("play");
  });

  it("shows Resume for partial saved progress", () => {
    expect(
      getGameAction({ completed: false, guesses: ["Partial guess"] }),
    ).toBe("resume");
  });

  it("shows Results for completed progress", () => {
    expect(getGameAction({ completed: true, guesses: ["Correct"] })).toBe(
      "results",
    );
  });
});

describe("Anidle exhaustion outside the game", () => {
  const history = (count: number) =>
    Array.from({ length: count }, (_, index) => ({ guess: `Wrong ${index}` }));

  it("treats an exhausted v2 game as finished, never Resume", () => {
    const exhausted = {
      completed: false,
      guesses: history(8).map((entry) => entry.guess),
      anidleHistory: history(8),
      attemptLimit: 8,
    };
    expect(isProgressExhausted(exhausted)).toBe(true);
    expect(getGameOutcome(exhausted)).toBe("exhausted");
    expect(getGameAction(exhausted)).toBe("results");
    expect(getGameStatusLabel(exhausted)).toBe("Out of guesses");
  });

  it("keeps a game with attempts left resumable", () => {
    const partial = {
      completed: false,
      guesses: ["Wrong"],
      anidleHistory: history(7),
      attemptLimit: 8,
    };
    expect(isProgressExhausted(partial)).toBe(false);
    expect(getGameOutcome(partial)).toBeNull();
    expect(getGameAction(partial)).toBe("resume");
    expect(getGameStatusLabel(partial)).toBe("In progress");
  });

  it("reports a final-attempt solve as solved, not exhausted", () => {
    const solved = {
      completed: true,
      guesses: ["x"],
      anidleHistory: history(8),
      attemptLimit: 8,
    };
    expect(isProgressExhausted(solved)).toBe(false);
    expect(getGameOutcome(solved)).toBe("solved");
    expect(getGameStatusLabel(solved)).toBe("Solved");
  });

  it("never exhausts legacy progress without an attempt limit", () => {
    const legacy = {
      completed: false,
      guesses: history(30).map((entry) => entry.guess),
      anidleHistory: history(30),
    };
    expect(isProgressExhausted(legacy)).toBe(false);
    expect(getGameAction(legacy)).toBe("resume");
  });
});
