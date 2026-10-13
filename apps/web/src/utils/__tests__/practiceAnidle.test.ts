import {
  EMPTY_TALLY,
  averageGuesses,
  formatAverage,
  parseSession,
  parseTally,
  recordPracticeResult,
} from "../practiceAnidle";

describe("practice tally", () => {
  it("counts played, solved and the average over solved games only", () => {
    let tally = recordPracticeResult(EMPTY_TALLY, { solved: true, guesses: 3 });
    tally = recordPracticeResult(tally, { solved: false, guesses: 8 });
    tally = recordPracticeResult(tally, { solved: true, guesses: 6 });
    expect(tally).toEqual({ played: 3, solved: 2, solvedGuesses: 9 });
    expect(averageGuesses(tally)).toBe(4.5);
    expect(formatAverage(tally)).toBe("4.5");
  });

  it("has no average before a solve", () => {
    expect(averageGuesses(EMPTY_TALLY)).toBeNull();
    expect(formatAverage(EMPTY_TALLY)).toBe("—");
  });

  it("repairs malformed stored values", () => {
    expect(parseTally(null)).toEqual(EMPTY_TALLY);
    expect(parseTally("nope")).toEqual(EMPTY_TALLY);
    expect(parseTally({ played: 2, solved: 9, solvedGuesses: -4 })).toEqual({
      played: 2,
      solved: 2,
      solvedGuesses: 0,
    });
  });

  it("rejects saved sessions without a usable puzzle", () => {
    expect(parseSession({ practiceId: "x" })).toBeNull();
    expect(parseSession(null)).toBeNull();
  });
});
