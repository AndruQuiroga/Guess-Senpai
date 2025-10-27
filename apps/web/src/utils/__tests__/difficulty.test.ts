import { describe, expect, it } from "vitest";

import { getDifficultyRoundOffset, resolveHintRound } from "../difficulty";

describe("getDifficultyRoundOffset", () => {
  it("returns a positive boost for easy difficulty", () => {
    expect(getDifficultyRoundOffset(1)).toBe(1);
    expect(getDifficultyRoundOffset(0.7)).toBe(1);
  });

  it("returns zero for normal difficulty", () => {
    expect(getDifficultyRoundOffset(2)).toBe(0);
    expect(getDifficultyRoundOffset(null)).toBe(0);
    expect(getDifficultyRoundOffset(undefined)).toBe(0);
  });

  it("returns a negative offset for hard difficulty", () => {
    expect(getDifficultyRoundOffset(3)).toBe(-1);
    expect(getDifficultyRoundOffset(4.2)).toBe(-1);
  });
});

describe("resolveHintRound", () => {
  it("applies the offset while clamping to round bounds", () => {
    expect(resolveHintRound(1, 3, 1)).toBe(2);
    expect(resolveHintRound(2, 3, 1)).toBe(3);
    expect(resolveHintRound(3, 3, 1)).toBe(3);
  });

  it("keeps the base round for normal difficulty", () => {
    expect(resolveHintRound(1, 3, 2)).toBe(1);
    expect(resolveHintRound(2, 3, null)).toBe(2);
  });

  it("reduces available hints on hard difficulty", () => {
    expect(resolveHintRound(2, 3, 3)).toBe(1);
    expect(resolveHintRound(3, 3, 3)).toBe(2);
  });

  it("handles edge cases with invalid values", () => {
    expect(resolveHintRound(0, 0, 1)).toBe(1);
    expect(resolveHintRound(Number.NaN, 5, undefined)).toBe(1);
    expect(resolveHintRound(10, 2, 3)).toBe(1);
  });
});
