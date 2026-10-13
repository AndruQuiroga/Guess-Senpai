import type {
  AnidleGuessEvaluation,
  ListFeedbackItem,
  ScalarFeedback,
} from "../types/anidle";

export function normalizeScalarFeedback(value: unknown): ScalarFeedback {
  if (!value || typeof value !== "object") {
    return { guess: null, target: null, status: "unknown" };
  }

  const record = value as {
    guess?: unknown;
    target?: unknown;
    status?: unknown;
    guess_season?: unknown;
    target_season?: unknown;
    guessSeason?: unknown;
    targetSeason?: unknown;
  };

  const guess =
    typeof record.guess === "number" && Number.isFinite(record.guess)
      ? record.guess
      : null;
  const target =
    typeof record.target === "number" && Number.isFinite(record.target)
      ? record.target
      : null;
  const rawStatus = record.status;
  const status =
    rawStatus === "match" ||
    rawStatus === "higher" ||
    rawStatus === "lower" ||
    rawStatus === "unknown"
      ? rawStatus
      : "unknown";
  const guessSeason =
    typeof record.guessSeason === "string"
      ? record.guessSeason
      : typeof record.guess_season === "string"
        ? record.guess_season
        : null;
  const targetSeason =
    typeof record.targetSeason === "string"
      ? record.targetSeason
      : typeof record.target_season === "string"
        ? record.target_season
        : null;

  return {
    guess,
    target,
    status,
    guessSeason,
    targetSeason,
  } satisfies ScalarFeedback;
}

export function normalizeListFeedback(value: unknown): ListFeedbackItem[] {
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
      const status =
        record.status === "match" || record.status === "miss"
          ? record.status
          : "miss";

      if (!label) {
        return null;
      }

      return { value: label, status } satisfies ListFeedbackItem;
    })
    .filter((item): item is ListFeedbackItem => Boolean(item));
}

/** Optional fields added after v1: episodes, format and cover art. */
export function normalizeExtraEvaluationFields(
  record: Record<string, unknown>,
): Pick<
  AnidleGuessEvaluation,
  "episodes" | "format" | "coverImage" | "matched"
> {
  const extra: Pick<
    AnidleGuessEvaluation,
    "episodes" | "format" | "coverImage" | "matched"
  > = {};
  if (record.episodes && typeof record.episodes === "object") {
    extra.episodes = normalizeScalarFeedback(record.episodes);
  }
  if (Array.isArray(record.format)) {
    extra.format = normalizeListFeedback(record.format);
  }
  const cover = record.coverImage ?? record.cover_image;
  if (typeof cover === "string" && cover) {
    extra.coverImage = cover;
  }
  if (record.matched === false) {
    extra.matched = false;
  }
  return extra;
}

export function normalizeAnidleEvaluation(
  value: unknown,
  fallbackTitle?: string,
): AnidleGuessEvaluation | null {
  if (!value || typeof value !== "object") {
    return fallbackTitle
      ? {
          title: fallbackTitle,
          correct: false,
          year: normalizeScalarFeedback(null),
          averageScore: normalizeScalarFeedback(null),
          popularity: normalizeScalarFeedback(null),
          genres: [],
          tags: [],
          studios: [],
          source: [],
        }
      : null;
  }

  const record = value as Record<string, unknown>;
  const title =
    typeof record.title === "string"
      ? record.title
      : typeof record["guess"] === "string"
        ? (record["guess"] as string)
        : (fallbackTitle ?? "");

  return {
    title,
    correct: Boolean(record.correct),
    year: normalizeScalarFeedback(record.year),
    averageScore: normalizeScalarFeedback(
      record.averageScore ?? record["average_score"],
    ),
    popularity: normalizeScalarFeedback(record.popularity),
    genres: normalizeListFeedback(record.genres),
    tags: normalizeListFeedback(record.tags),
    studios: normalizeListFeedback(record.studios),
    source: normalizeListFeedback(record.source),
    ...normalizeExtraEvaluationFields(record),
  } satisfies AnidleGuessEvaluation;
}
