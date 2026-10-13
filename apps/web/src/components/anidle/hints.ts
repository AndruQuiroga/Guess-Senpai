import type { AnidleGame } from "../../types/puzzles";

export type AnidleRules = NonNullable<AnidleGame["rules"]>;

export type AggregatedHint =
  | { type: "text"; label: string; value: string }
  | { type: "tags"; label: string; values: string[] }
  | { type: "synopsis"; label: string; ratio: number; text: string };

export const LEGACY_TOTAL_ROUNDS = 3;
const MIN_INCORRECT_GUESSES_FOR_HINT = 10;
const INCORRECT_GUESS_INTERVAL = 2;

/** Hints unlocked by the number of incorrect accepted guesses. */
export function computeAnidleHints(
  payload: AnidleGame,
  rules: AnidleRules | null,
  incorrectGuessCount: number,
): AggregatedHint[] {
  if (rules) {
    const stage = rules.hint_after_incorrect.filter(
      (count) => incorrectGuessCount >= count,
    ).length;
    if (!stage) return [];
    const entries = payload.hints.synopsis.filter((hint) => hint.text.trim());
    if (entries.length) {
      const hint = entries[Math.min(stage - 1, entries.length - 1)];
      return [
        {
          type: "synopsis",
          label: "Synopsis hint",
          ratio: hint.ratio,
          text: hint.text,
        },
      ];
    }
    const hints: AggregatedHint[] = [];
    if (payload.hints.genres.length)
      hints.push({
        type: "text",
        label: "Genres",
        value: payload.hints.genres.join(", "),
      });
    if (stage >= 2 && payload.hints.year != null)
      hints.push({
        type: "text",
        label: "Year",
        value: String(payload.hints.year),
      });
    if (stage >= 3 && payload.hints.tags.length)
      hints.push({
        type: "tags",
        label: "Tags",
        values: payload.hints.tags.slice(0, 4),
      });
    return hints;
  }

  if (incorrectGuessCount < MIN_INCORRECT_GUESSES_FOR_HINT) return [];

  const synopsisEntries = payload.hints.synopsis ?? [];
  if (synopsisEntries.length > 0) {
    const stage = Math.floor(
      (incorrectGuessCount - MIN_INCORRECT_GUESSES_FOR_HINT) /
        INCORRECT_GUESS_INTERVAL,
    );
    const entry = synopsisEntries[Math.min(stage, synopsisEntries.length - 1)];
    if (entry && entry.text.trim().length > 0) {
      return [
        {
          type: "synopsis",
          label: "Synopsis hint",
          ratio: entry.ratio,
          text: entry.text,
        },
      ];
    }
  }

  const fallback: AggregatedHint[] = [];
  const { hints } = payload;
  for (const spec of payload.spec) {
    for (const key of spec.hints) {
      switch (key) {
        case "genres":
          if (hints.genres.length > 0)
            fallback.push({
              type: "text",
              label: "Genres",
              value: hints.genres.slice(0, 3).join(", "),
            });
          break;
        case "tags":
          if (hints.tags.length > 0)
            fallback.push({
              type: "tags",
              label: "Tags",
              values: hints.tags.slice(0, 4),
            });
          break;
        case "year":
          if (hints.year != null)
            fallback.push({
              type: "text",
              label: "Year",
              value: String(hints.year),
            });
          break;
        case "episodes":
          if (hints.episodes != null)
            fallback.push({
              type: "text",
              label: "Episodes",
              value: String(hints.episodes),
            });
          break;
        case "duration":
          if (hints.duration)
            fallback.push({
              type: "text",
              label: "Duration",
              value: `${hints.duration} min`,
            });
          break;
        case "popularity":
          if (hints.popularity)
            fallback.push({
              type: "text",
              label: "Popularity",
              value: hints.popularity.toLocaleString(),
            });
          break;
        case "average_score":
          if (hints.average_score)
            fallback.push({
              type: "text",
              label: "Score",
              value: `${hints.average_score}%`,
            });
          break;
        default:
          break;
      }
    }
  }
  return fallback;
}
