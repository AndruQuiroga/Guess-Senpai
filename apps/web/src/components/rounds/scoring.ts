/**
 * Rounds v3 scoring. Every round of every round-based game is worth the same
 * ROUND_POINTS regardless of difficulty; difficulty comes from how obscure the
 * round's anime is. Each round is a single submission: fields score when
 * correct, and hints taken before submitting are deducted from the round.
 */
export const ROUND_POINTS = 1000;

export const DIFFICULTY_LABELS: Record<number, string> = {
  1: "Easy",
  2: "Medium",
  3: "Hard",
};

export function difficultyLabel(
  difficulty: number | null | undefined,
  order: number,
): string {
  return DIFFICULTY_LABELS[difficulty ?? order] ?? `Round ${order}`;
}

/** One checked field on the results screen. */
export interface ScoreLine {
  label: string;
  guess: string;
  answer: string;
  /** "close" earns part of the field's points (e.g. a year off by one). */
  verdict: "correct" | "close" | "wrong";
  points: number;
  max: number;
}

export interface RoundOutcome {
  lines: ScoreLine[];
  /** Points deducted for hints, already capped so the round never goes negative. */
  hintPenalty: number;
  points: number;
  max: number;
}

export function buildOutcome(
  lines: ScoreLine[],
  hintCost: number,
  max: number = ROUND_POINTS,
): RoundOutcome {
  const earned = lines.reduce((sum, line) => sum + line.points, 0);
  const hintPenalty = Math.min(earned, Math.max(0, Math.round(hintCost)));
  return {
    lines,
    hintPenalty,
    points: Math.max(0, earned - hintPenalty),
    max,
  };
}

export function line(
  label: string,
  guess: string,
  answer: string,
  verdict: ScoreLine["verdict"],
  max: number,
  closeShare = 0.5,
): ScoreLine {
  const points =
    verdict === "correct"
      ? max
      : verdict === "close"
        ? Math.round(max * closeShare)
        : 0;
  return { label, guess, answer, verdict, points, max };
}

/** Reads a stored outcome back from progress; null when it is not one. */
export function parseOutcome(value: unknown): RoundOutcome | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<RoundOutcome>;
  if (!Array.isArray(record.lines) || typeof record.points !== "number") {
    return null;
  }
  return {
    lines: record.lines.filter(
      (entry): entry is ScoreLine =>
        Boolean(entry) && typeof entry.label === "string",
    ),
    hintPenalty: Number(record.hintPenalty) || 0,
    points: record.points,
    max: typeof record.max === "number" ? record.max : ROUND_POINTS,
  };
}

const numberFormat = new Intl.NumberFormat("en-US");

export function formatPoints(value: number): string {
  return numberFormat.format(Math.round(value));
}
