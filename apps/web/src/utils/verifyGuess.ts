const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export interface GuessVerificationResult {
  correct: boolean;
  match?: string | null;
  animeMatch: boolean;
  characterMatch?: boolean | null;
  characterName?: string | null;
  characterId?: number | null;
  seasonMatch?: boolean | null;
  seasonYearMatch?: boolean | null;
}

interface VerifyGuessOptions {
  characterGuess?: string | null;
  characterId?: number | null;
  season?: string | null;
  seasonYear?: number | null;
}

export async function verifyGuess(
  mediaId: number,
  guess: string,
  guessMediaId?: number,
  options: VerifyGuessOptions = {},
): Promise<GuessVerificationResult> {
  const response = await fetch(`${API_BASE}/puzzles/verify`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      media_id: mediaId,
      guess,
      guess_media_id: guessMediaId ?? null,
      character_guess: options.characterGuess ?? null,
      guess_character_id: options.characterId ?? null,
      season: options.season ?? null,
      season_year: options.seasonYear ?? null,
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

  const payload = (await response.json()) as
    | (GuessVerificationResult & {
        anime_match?: boolean;
        character_match?: boolean | null;
        character?: string | null;
        character_id?: number | null;
        season_match?: boolean | null;
        season_year_match?: boolean | null;
      })
    | null;
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid verification response");
  }

  const animeMatchSource =
    payload.animeMatch ?? payload.anime_match ?? payload.correct;
  const animeMatch = Boolean(animeMatchSource);

  const characterMatchSource =
    payload.characterMatch ?? payload.character_match;
  const characterMatch =
    typeof characterMatchSource === "boolean"
      ? characterMatchSource
      : characterMatchSource === null
        ? null
        : null;

  const seasonMatchSource = payload.seasonMatch ?? payload.season_match;
  const seasonMatch =
    typeof seasonMatchSource === "boolean"
      ? seasonMatchSource
      : seasonMatchSource === null
        ? null
        : null;

  const seasonYearMatchSource =
    payload.seasonYearMatch ?? payload.season_year_match;
  const seasonYearMatch =
    typeof seasonYearMatchSource === "boolean"
      ? seasonYearMatchSource
      : seasonYearMatchSource === null
        ? null
        : null;

  return {
    correct: Boolean(payload.correct),
    match: payload.match ?? null,
    animeMatch,
    characterMatch,
    characterName:
      payload.characterName ?? payload.character ?? null,
    characterId:
      typeof payload.characterId === "number"
        ? payload.characterId
        : typeof payload.character_id === "number"
          ? payload.character_id
          : null,
    seasonMatch,
    seasonYearMatch,
  };
}
