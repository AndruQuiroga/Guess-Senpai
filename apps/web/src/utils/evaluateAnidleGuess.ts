import type { AnidleGuessEvaluation } from "../types/anidle";
import {
  normalizeAnidleEvaluation,
  normalizeListFeedback,
  normalizeScalarFeedback,
} from "./normalizeAnidleEvaluation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

interface EvaluateAnidleGuessPayload {
  puzzleMediaId: number;
  guess: string;
  guessMediaId?: number;
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
    year: normalizeScalarFeedback(payload.year),
    averageScore: normalizeScalarFeedback(payload.average_score ?? payload.averageScore),
    popularity: normalizeScalarFeedback(payload.popularity),
    genres: normalizeListFeedback(payload.genres),
    tags: normalizeListFeedback(payload.tags),
    studios: normalizeListFeedback(payload.studios),
    source: normalizeListFeedback(payload.source),
  };
}

export { normalizeAnidleEvaluation };
