import { GAME_STATUS_TEXT, getGameStatus } from "../gameAction";

describe("getGameStatus", () => {
  it("maps progress to the four navigation statuses", () => {
    expect(getGameStatus(undefined)).toBe("new");
    expect(getGameStatus({ guesses: ["a"], completed: false })).toBe(
      "in-progress",
    );
    expect(getGameStatus({ guesses: ["a"], completed: true })).toBe("solved");
    expect(
      getGameStatus({
        completed: false,
        guesses: ["a", "b"],
        anidleHistory: [{}, {}],
        attemptLimit: 2,
      }),
    ).toBe("out-of-guesses");
  });

  it("has user-facing text for every status", () => {
    expect(GAME_STATUS_TEXT).toEqual({
      new: "New",
      "in-progress": "In progress",
      solved: "Solved",
      "out-of-guesses": "Out of guesses",
    });
  });
});
