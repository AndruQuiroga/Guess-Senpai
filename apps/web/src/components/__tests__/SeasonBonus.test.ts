import { describe, expect, it } from "vitest";
import {
  matchesSeriesTitle,
  seasonBonusLines,
  seasonRoundMax,
} from "../rounds/SeasonBonus";
import { computeDailyScore, scoreGame } from "../../utils/dailyScore";
import {
  buildRuntimeGamesDirectory,
  getPlayableGames,
} from "../../config/games";
import { buildShareEvent } from "../../utils/shareText";

const meta = {
  year: 2020,
  season: "SPRING 2020",
  seasonNumber: 3,
  seasonOptions: [1, 2, 3],
  seriesTitles: ["A Show"],
};

describe("season bonuses", () => {
  it("projects the daily maximum before playing and preserves older round maxima", () => {
    expect(
      computeDailyScore(
        ["guess_the_opening"],
        {},
        { guess_the_opening: [1400, 1200, 1400] },
      ),
    ).toMatchObject({ total: 0, max: 4000 });
    const progress = {
      completed: false,
      round: 2,
      guesses: [],
      rounds: [
        {
          round: 1,
          guesses: [],
          completed: true,
          points: 900,
          result: { max: 1000 },
        },
      ],
    };
    expect(
      computeDailyScore(
        ["poster_zoomed"],
        { poster_zoomed: progress },
        { poster_zoomed: [800, 800, 600] },
      ),
    ).toMatchObject({ total: 900, max: 2400 });
  });
  it.each([
    ["2019", "SPRING", "", 50],
    ["2021", "FALL", "", 50],
    ["2020", "", "", 100],
    ["2020", "FALL", "", 100],
    ["2020", "SPRING", "", 200],
    ["2020", "SPRING", "3", 400],
    ["", "", "3", 200],
    ["", "SPRING", "", 0],
    ["2018", "SPRING", "2", 0],
    ["", "", "", 0],
  ])(
    "year %s / release season %s / numbered season %s earns %i",
    (year, season, seasonNumber, expected) => {
      const lines = seasonBonusLines(
        meta,
        { year, season, seasonNumber },
        true,
      );
      expect(lines.reduce((sum, line) => sum + line.points, 0)).toBe(expected);
      expect(
        seasonBonusLines(meta, { year, season, seasonNumber }, false).every(
          (line) => line.points === 0,
        ),
      ).toBe(true);
    },
  );

  it("omits unknown metadata instead of charging unavailable points", () => {
    expect(seasonRoundMax(1000, {})).toBe(1000);
    expect(
      seasonBonusLines(
        {},
        { year: "2020", season: "SPRING", seasonNumber: "1" },
        true,
      ),
    ).toEqual([]);
    expect(seasonRoundMax(1000, meta)).toBe(1400);
    expect(seasonRoundMax(600, meta)).toBe(1000);
    expect(matchesSeriesTitle(" A SHOW ", meta)).toBe(true);
    expect(matchesSeriesTitle("Other show", meta)).toBe(false);
  });

  it("omits the numbered-season bonus for a sole season or unavailable choices", () => {
    for (const seasonOptions of [[], [1], undefined]) {
      const single = { year: 2020, seasonNumber: 1, seasonOptions };
      expect(seasonRoundMax(600, single)).toBe(700);
      expect(
        seasonBonusLines(
          single,
          { year: "", season: "", seasonNumber: "1" },
          true,
        ).some((line) => line.label === "Numbered season"),
      ).toBe(false);
    }
    expect(seasonRoundMax(600, { year: 2020, seasonOptions: [] })).toBe(700);
  });

  it("keeps opening bonus points in daily totals and the saved maximum", () => {
    const progress = {
      completed: true,
      round: 3,
      guesses: [],
      maxPoints: 4200,
      rounds: [1, 2, 3].map((round) => ({
        round,
        guesses: [],
        completed: true,
        points: 1400,
      })),
    };
    expect(scoreGame("guess_the_opening", progress)).toBe(4200);
    expect(
      computeDailyScore(["guess_the_opening"], { guess_the_opening: progress }),
    ).toMatchObject({ total: 4200, max: 4200 });
    expect(scoreGame("poster_zoomed", { ...progress, maxPoints: 9000 })).toBe(
      3000,
    );
  });

  it("shows Poster Modified only when today's snapshot supplies it", () => {
    const playable = (enabled: boolean) =>
      getPlayableGames(
        buildRuntimeGamesDirectory({
          guessTheOpeningEnabled: false,
          posterModifiedEnabled: enabled,
        }),
      ).map((game) => game.gameKey);
    expect(playable(false)).not.toContain("poster_modified");
    expect(playable(true)).toContain("poster_modified");
    expect(playable(true)).toContain("poster_zoomed");
    expect(
      buildShareEvent(
        "2026-10-13",
        {},
        { includePosterModified: false },
      ).games.some((game) => game.key === "poster_modified"),
    ).toBe(false);
    expect(
      buildShareEvent(
        "2026-10-13",
        {},
        { includePosterModified: true },
      ).games.some((game) => game.key === "poster_modified"),
    ).toBe(true);
  });
});
