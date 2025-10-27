const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export interface GuessVerificationResult {
  correct: boolean;
  match?: string | null;
}

export async function verifyGuess(
  mediaId: number,
  guess: string,
  guessMediaId?: number,
): Promise<GuessVerificationResult> {
  const response = await fetch(`${API_BASE}/puzzles/verify`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      media_id: mediaId,
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
      // ignore json parse issues
    }
    throw new Error(detail ?? `Verification failed (${response.status})`);
  }

  const payload = (await response.json()) as GuessVerificationResult | null;
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid verification response");
  }

  return {
    correct: Boolean(payload.correct),
    match: payload.match ?? null,
  };
}
