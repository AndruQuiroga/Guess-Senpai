import type { AnidleGame } from "../../types/puzzles";

export type AnidleRules = NonNullable<AnidleGame["rules"]>;

export type AggregatedHint =
  | { type: "text"; label: string; value: string }
  | { type: "tags"; label: string; values: string[] }
  | { type: "synopsis"; label: string; ratio: number; text: string };

export const LEGACY_TOTAL_ROUNDS = 3;
export type AnidleClueId = "genres" | "year" | "synopsis";

/**
 * Rules-v2 Anidle clues: three types, each with its own price and its own
 * unlock point (the matching entry of `rules.hint_after_incorrect`). Players
 * buy any unlocked clue they want; nothing is shown otherwise.
 */
export const ANIDLE_CLUES: readonly {
  id: AnidleClueId;
  label: string;
  cost: number;
}[] = [
  { id: "genres", label: "Genres", cost: 150 },
  { id: "year", label: "Release year", cost: 150 },
  { id: "synopsis", label: "Synopsis excerpt", cost: 300 },
];

const CLUE_IDS = new Set<string>(ANIDLE_CLUES.map((clue) => clue.id));

export function isAnidleClueId(value: unknown): value is AnidleClueId {
  return typeof value === "string" && CLUE_IDS.has(value);
}

/** Total points the bought clues cost. */
export function anidleClueCost(ids: readonly string[]): number {
  return ANIDLE_CLUES.filter((clue) => ids.includes(clue.id)).reduce(
    (sum, clue) => sum + clue.cost,
    0,
  );
}

/** Older saves stored a count of progressive hints; map them onto types. */
export function legacyAnidleClues(count: number): AnidleClueId[] {
  return ANIDLE_CLUES.slice(0, Math.max(0, count)).map((clue) => clue.id);
}

/** Wrong guesses after which clue `index` can be bought. */
export function anidleClueUnlockAt(rules: AnidleRules, index: number): number {
  const thresholds = rules.hint_after_incorrect;
  return thresholds[index] ?? thresholds[thresholds.length - 1] ?? 0;
}

/** The synopsis clue falls back to tags for anime without a synopsis. */
export function anidleClueLabel(payload: AnidleGame, id: AnidleClueId): string {
  if (id === "synopsis" && !synopsisExcerpt(payload)) return "Tags";
  return ANIDLE_CLUES.find((clue) => clue.id === id)?.label ?? id;
}

export function anidleClueAvailable(
  payload: AnidleGame,
  id: AnidleClueId,
): boolean {
  if (id === "genres") return payload.hints.genres.length > 0;
  if (id === "year") return payload.hints.year != null;
  return Boolean(synopsisExcerpt(payload)) || payload.hints.tags.length > 0;
}

/** A middle redaction level: enough to help without giving the show away. */
function synopsisExcerpt(payload: AnidleGame) {
  const entries = (payload.hints.synopsis ?? []).filter((hint) =>
    hint.text.trim(),
  );
  return entries.length ? entries[Math.min(1, entries.length - 1)] : null;
}

/**
 * What solving on the next guess would score: the game's points shrink by one
 * guess's share per accepted guess, minus what bought clues cost.
 */
export function anidleStake(
  maxPoints: number,
  attemptLimit: number,
  used: number,
  clueCost: number,
): number {
  const limit = Math.max(1, attemptLimit);
  const base = (maxPoints * Math.max(0, limit - used)) / limit;
  return Math.max(0, Math.round(base - clueCost));
}
const MIN_INCORRECT_GUESSES_FOR_HINT = 10;
const INCORRECT_GUESS_INTERVAL = 2;

/** Player-facing summary of the rules-v2 guess budget and clues. */
export function describeAnidleRules(rules: AnidleRules): string[] {
  const clues = ANIDLE_CLUES.map(
    (clue, index) =>
      `${clue.label.toLowerCase()} (−${clue.cost}, after ${anidleClueUnlockAt(rules, index)} misses)`,
  ).join(", ");
  return [
    `Find one exact anime title in ${rules.max_attempts} accepted guesses. Solving sooner scores more.`,
    rules.hint_after_incorrect.length
      ? `Optional clues, each bought separately: ${clues}.`
      : "This puzzle has no clues.",
  ];
}

/**
 * Hints shown to the player. Rules v2 shows exactly the clues bought;
 * legacy rules unlock by misses.
 */
export function computeAnidleHints(
  payload: AnidleGame,
  rules: AnidleRules | null,
  incorrectGuessCount: number,
  revealed: readonly AnidleClueId[] = [],
): AggregatedHint[] {
  if (rules) {
    const hints: AggregatedHint[] = [];
    if (revealed.includes("genres") && payload.hints.genres.length)
      hints.push({
        type: "text",
        label: "Genres",
        value: payload.hints.genres.join(", "),
      });
    if (revealed.includes("year") && payload.hints.year != null)
      hints.push({
        type: "text",
        label: "Release year",
        value: String(payload.hints.year),
      });
    if (revealed.includes("synopsis")) {
      const excerpt = synopsisExcerpt(payload);
      if (excerpt)
        hints.push({
          type: "synopsis",
          label: "Synopsis excerpt",
          ratio: excerpt.ratio,
          text: excerpt.text,
        });
      else if (payload.hints.tags.length)
        hints.push({
          type: "tags",
          label: "Tags",
          values: payload.hints.tags.slice(0, 4),
        });
    }
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
