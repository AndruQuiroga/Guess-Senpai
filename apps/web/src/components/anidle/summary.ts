import type { AnidleGuessEvaluation } from "../../types/anidle";
import {
  formatPopularity,
  listFeedback,
  scalarFeedback,
  SCALAR_COLUMNS,
  type ListKey,
  type ScalarKey,
} from "./tiles";

export interface ScalarKnowledge {
  key: ScalarKey;
  label: string;
  /** "2010–2015", "12", "> 190k", or null when nothing is known yet. */
  text: string | null;
  exact: boolean;
}

export interface ListKnowledge {
  key: ListKey;
  label: string;
  confirmed: string[];
  excluded: string[];
}

export interface AnidleKnowledge {
  scalars: ScalarKnowledge[];
  lists: ListKnowledge[];
}

const LIST_LABELS: Record<ListKey, string> = {
  format: "Format",
  source: "Source",
  genres: "Genres",
  tags: "Tags",
  studios: "Studio",
};
const LIST_ORDER: ListKey[] = ["format", "source", "genres", "tags", "studios"];

function formatValue(key: ScalarKey, value: number): string {
  if (key === "popularity") return formatPopularity(value);
  if (key === "averageScore") return `${value}%`;
  return String(value);
}

/**
 * Narrow one numeric attribute from every guess. "higher" means the guess was
 * above the answer, so it caps the range; "lower" raises the floor. Bounds are
 * exclusive; integer attributes are shown as an inclusive range.
 */
function scalarKnowledge(
  key: ScalarKey,
  label: string,
  evaluations: AnidleGuessEvaluation[],
): ScalarKnowledge {
  let floor = -Infinity;
  let ceiling = Infinity;
  for (const evaluation of evaluations) {
    const feedback = scalarFeedback(evaluation, key);
    if (typeof feedback.guess !== "number") continue;
    if (feedback.status === "match") {
      return {
        key,
        label,
        text: formatValue(key, feedback.guess),
        exact: true,
      };
    }
    if (feedback.status === "higher")
      ceiling = Math.min(ceiling, feedback.guess);
    if (feedback.status === "lower") floor = Math.max(floor, feedback.guess);
  }
  const integer = key !== "popularity";
  const low = Number.isFinite(floor) ? (integer ? floor + 1 : floor) : null;
  const high = Number.isFinite(ceiling)
    ? integer
      ? ceiling - 1
      : ceiling
    : null;
  let text: string | null = null;
  if (low != null && high != null) {
    text =
      integer && low === high
        ? formatValue(key, low)
        : `${formatValue(key, low)}–${formatValue(key, high)}`;
  } else if (low != null) {
    text = integer
      ? `≥ ${formatValue(key, low)}`
      : `> ${formatValue(key, low)}`;
  } else if (high != null) {
    text = integer
      ? `≤ ${formatValue(key, high)}`
      : `< ${formatValue(key, high)}`;
  }
  return { key, label, text, exact: integer && low != null && low === high };
}

function listKnowledge(
  key: ListKey,
  evaluations: AnidleGuessEvaluation[],
): ListKnowledge {
  const confirmed = new Map<string, string>();
  const excluded = new Map<string, string>();
  for (const evaluation of evaluations) {
    for (const item of listFeedback(evaluation, key)) {
      const id = item.value.toLowerCase();
      if (item.status === "match") confirmed.set(id, item.value);
      else excluded.set(id, item.value);
    }
  }
  for (const id of confirmed.keys()) excluded.delete(id);
  return {
    key,
    label: LIST_LABELS[key],
    confirmed: [...confirmed.values()],
    excluded: [...excluded.values()],
  };
}

/** Everything the guesses so far reveal about the answer. */
export function summarizeEvaluations(
  evaluations: (AnidleGuessEvaluation | null)[],
): AnidleKnowledge {
  const known = evaluations.filter(
    (entry): entry is AnidleGuessEvaluation => entry != null,
  );
  return {
    scalars: SCALAR_COLUMNS.map((column) =>
      scalarKnowledge(column.key, column.label, known),
    ),
    lists: LIST_ORDER.map((key) => listKnowledge(key, known)),
  };
}
