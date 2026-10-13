import type { AnidleGame } from "../../types/puzzles";

export type AnidleRules = NonNullable<AnidleGame["rules"]>;

export type AggregatedHint =
  | { type: "text"; label: string; value: string }
  | { type: "tags"; label: string; values: string[] }
  | { type: "synopsis"; label: string; ratio: number; text: string };

export const LEGACY_TOTAL_ROUNDS = 3;
const MIN_INCORRECT_GUESSES_FOR_HINT = 10;
const INCORRECT_GUESS_INTERVAL = 2;

/** How many rules-v2 hints the player has earned (they still choose to reveal). */
export function availableHintCount(
  rules: AnidleRules,
  incorrectGuessCount: number,
): number {
  return rules.hint_after_incorrect.filter(
    (count) => incorrectGuessCount >= count,
  ).length;
}

/** Wrong guesses still needed before the next hint becomes available. */
export function missesUntilNextHint(
  rules: AnidleRules,
  incorrectGuessCount: number,
): number | null {
  const next = rules.hint_after_incorrect.find(
    (count) => count > incorrectGuessCount,
  );
  return next == null ? null : next - incorrectGuessCount;
}

/** Player-facing summary of the rules-v2 guess budget and hint cadence. */
export function describeAnidleRules(rules: AnidleRules): string[] {
  const thresholds = rules.hint_after_incorrect;
  const list =
    thresholds.length > 1
      ? `${thresholds.slice(0, -1).join(", ")} and ${thresholds[thresholds.length - 1]}`
      : String(thresholds[0] ?? "");
  return [
    `Find one exact anime title in ${rules.max_attempts} accepted guesses.`,
    thresholds.length
      ? `Optional hints become available after ${list} wrong guesses. Nothing is revealed unless you ask: a partly redacted synopsis, or genres, then year, then tags when no synopsis exists.`
      : "This puzzle has no hints.",
  ];
}

/**
 * Hints shown to the player. Rules v2 shows the `revealed` hints the player
 * asked for (capped by what they have earned); legacy rules unlock by misses.
 */
export function computeAnidleHints(
  payload: AnidleGame,
  rules: AnidleRules | null,
  incorrectGuessCount: number,
  revealed = 0,
): AggregatedHint[] {
  if (rules) {
    const stage = Math.min(
      revealed,
      availableHintCount(rules, incorrectGuessCount),
    );
    if (stage <= 0) return [];
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
