import { describe, expect, it } from "vitest";

import { formatDurationFromMs, getMsUntilNextUtcMidnight } from "../time";

describe("getMsUntilNextUtcMidnight", () => {
  it("counts to the next 00:00 UTC", () => {
    const now = Date.UTC(2026, 9, 12, 21, 18, 27);
    expect(formatDurationFromMs(getMsUntilNextUtcMidnight(now))).toBe(
      "02:41:33",
    );
  });

  it("never exceeds 24 hours, even exactly at midnight", () => {
    const midnight = Date.UTC(2026, 9, 12, 0, 0, 0);
    expect(getMsUntilNextUtcMidnight(midnight)).toBe(24 * 3600 * 1000);
    expect(getMsUntilNextUtcMidnight(midnight - 1)).toBe(1);
    expect(formatDurationFromMs(getMsUntilNextUtcMidnight(midnight))).toBe(
      "24:00:00",
    );
  });

  it("crosses month and year boundaries", () => {
    const now = Date.UTC(2026, 11, 31, 23, 0, 0);
    expect(getMsUntilNextUtcMidnight(now)).toBe(3600 * 1000);
  });
});
