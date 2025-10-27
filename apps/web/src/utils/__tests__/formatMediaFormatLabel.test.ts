import { describe, expect, it } from "vitest";

import { formatMediaFormatLabel } from "../formatMediaFormatLabel";

describe("formatMediaFormatLabel", () => {
  it("keeps known acronyms uppercase", () => {
    expect(formatMediaFormatLabel("TV")).toBe("TV");
    expect(formatMediaFormatLabel("ONA")).toBe("ONA");
  });

  it("title cases other segments while preserving acronyms", () => {
    expect(formatMediaFormatLabel("TV_SHORT")).toBe("TV Short");
    expect(formatMediaFormatLabel("tv special")).toBe("TV Special");
  });
});
