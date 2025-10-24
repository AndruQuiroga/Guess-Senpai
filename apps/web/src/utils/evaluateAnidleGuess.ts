const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export type ScalarStatus = "match" | "higher" | "lower" | "unknown";
export type ListStatus = "match" | "miss";

export interface ScalarFeedback {
  guess: number | null;
  target: number | null;
  status: ScalarStatus;
}

export interface ListFeedbackItem {
  value: string;
  status: ListStatus;
}

export interface AnidleGuessEvaluation {
  title: string;
  correct: boolean;
  year: ScalarFeedback;
  averageScore: ScalarFeedback;
  genres: ListFeedbackItem[];
  tags: ListFeedbackItem[];
}

interface EvaluateAnidleGuessPayload {
  puzzleMediaId: number;
  guess: string;
  guessMediaId?: number;
}

function normalizeScalar(value: unknown): ScalarFeedback {
  if (!value || typeof value !== "object") {
    return { guess: null, target: null, status: "unknown" };
  }
  const record = value as {
    guess?: unknown;
    target?: unknown;
    status?: unknown;
  };
  const guess = typeof record.guess === "number" ? record.guess : null;
  const target = typeof record.target === "number" ? record.target : null;
  const status =
    record.status === "match" ||
    record.status === "higher" ||
    record.status === "lower" ||
    record.status === "unknown"
      ? record.status
      : "unknown";
  return { guess, target, status };
}

function normalizeList(value: unknown): ListFeedbackItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const record = item as { value?: unknown; status?: unknown };
      const label = typeof record.value === "string" ? record.value : null;
      const status = record.status === "match" || record.status === "miss" ? record.status : "miss";
      if (!label) {
        return null;
      }
      return { value: label, status } satisfies ListFeedbackItem;
    })
    .filter((item): item is ListFeedbackItem => Boolean(item));
}

export async function evaluateAnidleGuess({
  puzzleMediaId,
  guess,
  guessMediaId,
}: EvaluateAnidleGuessPayload): Promise<AnidleGuessEvaluation> {
  const response = await fetch(`${API_BASE}/puzzles/anidle/evaluate`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      puzzle_media_id: puzzleMediaId,
      guess,
      guess_media_id: guessMediaId ?? null,
    }),
  });

  if (!response.ok) {
    let detail: string | undefined;
    try {
      const payload = (await response.json()) as { detail?: string };
      detail = payload?.detail;
    } catch (error) {
      // ignore JSON parse issues
    }
    throw new Error(detail ?? `Evaluation failed (${response.status})`);
  }

  const payload = (await response.json()) as Record<string, unknown> | null;
  if (!payload) {
    throw new Error("Invalid evaluation response");
  }

  return {
    title: typeof payload.title === "string" ? payload.title : guess,
    correct: Boolean(payload.correct),
    year: normalizeScalar(payload.year),
    averageScore: normalizeScalar(payload.average_score),
    genres: normalizeList(payload.genres),
    tags: normalizeList(payload.tags),
  };
}
