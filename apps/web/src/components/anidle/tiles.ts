import type {
  AnidleGuessEvaluation,
  ListFeedbackItem,
  ScalarFeedback,
} from "../../types/anidle";

export type Tone = "correct" | "close" | "wrong";
export type ScalarKey = "year" | "averageScore" | "popularity" | "episodes";
export type ListKey = "format" | "source" | "genres" | "tags" | "studios";

export interface ScalarTile {
  tone: Tone;
  /** Glyph shown beside the value. The arrow points toward the answer. */
  icon: "✓" | "↑" | "↓" | "?";
  value: string;
  season: string | null;
  /** Screen-reader text; colour is never the only signal. */
  label: string;
}

export interface ListTile {
  tone: Tone;
  matched: string[];
  /** Items not shown as a matched chip (misses plus matches over the cap). */
  hiddenCount: number;
  unmatched: string[];
  total: number;
  label: string;
}

/** The evaluation as the grid renders it (cover art and the v2 columns are optional). */
export type AnidleEvaluationView = AnidleGuessEvaluation;

/** Shown for evaluations saved before episodes existed. */
const NO_DATA: ScalarFeedback = {
  guess: null,
  target: null,
  status: "unknown",
};

/*
 * Column order is the DOM order. `span` is the width in the 6-column mobile
 * card: three scalars, then episodes + format + source, then genres + tags,
 * then studio on its own row.
 */
export const SCALAR_COLUMNS: readonly {
  key: ScalarKey;
  label: string;
  suffix?: string;
}[] = [
  { key: "year", label: "Year" },
  { key: "averageScore", label: "Score", suffix: "%" },
  { key: "popularity", label: "Popularity" },
  { key: "episodes", label: "Episodes" },
];

export const LIST_COLUMNS: readonly {
  key: ListKey;
  label: string;
  cap: number;
  /** Width (of 6) on the mobile card. */
  span: 2 | 3 | 6;
}[] = [
  { key: "format", label: "Format", cap: 1, span: 2 },
  { key: "source", label: "Source", cap: 1, span: 2 },
  { key: "genres", label: "Genres", cap: 3, span: 3 },
  { key: "tags", label: "Tags", cap: 3, span: 3 },
  { key: "studios", label: "Studio", cap: 2, span: 6 },
];

export function scalarFeedback(
  entry: AnidleGuessEvaluation,
  key: ScalarKey,
): ScalarFeedback {
  return entry[key] ?? NO_DATA;
}

export function listFeedback(
  entry: AnidleGuessEvaluation,
  key: ListKey,
): ListFeedbackItem[] {
  return entry[key] ?? [];
}

/** How near a miss must be to count as "close". */
function isClose(key: ScalarKey, guess: number, target: number): boolean {
  if (key === "year") return Math.abs(guess - target) <= 2;
  if (key === "averageScore") return Math.abs(guess - target) <= 5;
  const high = Math.max(guess, target);
  return high > 0 && Math.min(guess, target) / high >= 0.7;
}

export function formatPopularity(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
}

export function scalarTile(key: ScalarKey, fb: ScalarFeedback): ScalarTile {
  const column = SCALAR_COLUMNS.find((entry) => entry.key === key);
  const known = typeof fb.guess === "number";
  const value = !known
    ? "—"
    : key === "popularity"
      ? formatPopularity(fb.guess as number)
      : `${fb.guess}${column?.suffix ?? ""}`;
  const season =
    key === "year" && fb.guessSeason ? fb.guessSeason.toLowerCase() : null;
  const name = column?.label ?? key;

  if (fb.status === "match") {
    return {
      tone: "correct",
      icon: "✓",
      value,
      season,
      label: `${name} ${value}: exact match`,
    };
  }
  if (fb.status === "higher" || fb.status === "lower") {
    // "higher" means the guess is above the answer, so the answer is lower.
    const answerHigher = fb.status === "lower";
    const near =
      known &&
      typeof fb.target === "number" &&
      isClose(key, fb.guess as number, fb.target);
    return {
      tone: near ? "close" : "wrong",
      icon: answerHigher ? "↑" : "↓",
      value,
      season,
      label: `${name} ${value}: ${near ? "close, " : ""}the answer is ${
        answerHigher ? "higher" : "lower"
      }`,
    };
  }
  return {
    tone: "wrong",
    icon: "?",
    value,
    season,
    label: `${name}: no data`,
  };
}

export function listTile(items: ListFeedbackItem[], cap: number): ListTile {
  const matchedAll = items
    .filter((item) => item.status === "match")
    .map((item) => item.value);
  const unmatched = items
    .filter((item) => item.status !== "match")
    .map((item) => item.value);
  const matched = matchedAll.slice(0, cap);
  const total = items.length;
  const tone: Tone =
    total === 0 || matchedAll.length === 0
      ? "wrong"
      : unmatched.length === 0
        ? "correct"
        : "close";
  const label =
    total === 0
      ? "No data"
      : `${matchedAll.length} of ${total} match${
          matchedAll.length ? `: ${matchedAll.join(", ")}` : ""
        }`;
  return {
    tone,
    matched,
    hiddenCount: total - matched.length,
    unmatched,
    total,
    label,
  };
}

/** One tone per comparison column, used by the compact result mini grid. */
export function evaluationTones(entry: AnidleGuessEvaluation): Tone[] {
  return [
    ...SCALAR_COLUMNS.map(
      (column) =>
        scalarTile(column.key, scalarFeedback(entry, column.key)).tone,
    ),
    ...LIST_COLUMNS.map(
      (column) => listTile(listFeedback(entry, column.key), column.cap).tone,
    ),
  ];
}

export const TONE_CLASS: Record<Tone, string> = {
  correct: "border-correct bg-correct text-ink",
  close: "border-dashed border-close bg-close text-ink",
  wrong: "border-wrong bg-wrong-soft text-wrong-ink",
};

export const TONE_SWATCH: Record<Tone, string> = {
  correct: "bg-correct",
  close: "bg-close",
  wrong: "bg-wrong",
};
