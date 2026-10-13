import { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import {
  DailyAvailabilityProvider,
  useDailyAvailability,
} from "../useDailyAvailability";
import { buildRuntimeGamesDirectory } from "../../config/games";

function Status() {
  const availability = useDailyAvailability();
  return (
    <div>
      <span>{availability.status}</span>
      <span>
        {availability.guessTheOpeningEnabled
          ? "opening-ready"
          : "opening-disabled"}
      </span>
    </div>
  );
}

describe("daily availability", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reports malformed response as an error under Strict Mode", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({}) })),
    );
    render(
      <StrictMode>
        <DailyAvailabilityProvider>
          <Status />
        </DailyAvailabilityProvider>
      </StrictMode>,
    );
    await waitFor(() => expect(screen.getByText("error")).toBeInTheDocument());
    expect(screen.getByText("opening-disabled")).toBeInTheDocument();
  });

  it("distinguishes a ready response with the optional mode disabled", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          guess_the_opening_enabled: false,
          date: "2026-10-12",
          puzzle_id: "daily:2026-10-12",
          rules_version: "1",
          reset_at: "2026-10-13T00:00:00Z",
          available_modes: ["anidle"],
        }),
      })),
    );
    render(
      <DailyAvailabilityProvider>
        <Status />
      </DailyAvailabilityProvider>,
    );
    await waitFor(() => expect(screen.getByText("ready")).toBeInTheDocument());
    expect(screen.getByText("opening-disabled")).toBeInTheDocument();
    const directory = buildRuntimeGamesDirectory({
      guessTheOpeningEnabled: false,
    });
    expect(directory.find((game) => game.slug === "anidle")?.playable).toBe(
      true,
    );
    expect(
      directory.find((game) => game.slug === "guess-the-opening")?.playable,
    ).toBe(false);
  });
});
