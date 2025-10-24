import { DailyProgress, GameKey } from "../types/progress";

const GAME_DESCRIPTORS: Array<{
  label: string;
  key: GameKey;
  totalRounds: number;
}> = [
  { label: "Anidle", key: "anidle", totalRounds: 3 },
  { label: "Poster Zoomed", key: "poster_zoomed", totalRounds: 3 },
  { label: "Redacted Synopsis", key: "redacted_synopsis", totalRounds: 3 },
  { label: "Guess the Opening", key: "guess_the_opening", totalRounds: 3 },
];

export interface ShareTextOptions {
  includeGuessTheOpening?: boolean;
  aniListUrls?: string[];
  /** @deprecated use aniListUrls */
  aniListUrl?: string;
}

export function formatShareDate(value: string): string {
  const [year, month, day] = value
    .split("-")
    .map((part) => Number.parseInt(part, 10));
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, day));
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function buildShareText(
  dateIso: string,
  progress: DailyProgress,
  options?: ShareTextOptions,
): string {
  const formattedDate = formatShareDate(dateIso);
  const lines: string[] = [];
  lines.push(`GuessSenpai — ${formattedDate}`);

  const includeOpening = options?.includeGuessTheOpening ?? false;
  const requiredKeys: GameKey[] = [
    "anidle",
    "poster_zoomed",
    "redacted_synopsis",
  ];
  if (includeOpening) {
    requiredKeys.push("guess_the_opening");
  }

  const describe = (label: string, key: GameKey, totalRounds: number) => {
    const game = progress[key];
    if (!game) {
      return `${label} — ⏳`;
    }
    if (game.completed) {
      if (key === "anidle") {
        const attempts = Math.max(1, game.guesses.length);
        return `${label} — ${attempts} ${attempts === 1 ? "try" : "tries"} ✅`;
      }
      return `${label} — ✅ (${Math.min(totalRounds, game.round)}/${totalRounds})`;
    }
    return `${label} — ${Math.min(totalRounds, game.round)}/${totalRounds}`;
  };

  GAME_DESCRIPTORS.forEach(({ label, key, totalRounds }) => {
    if (key === "guess_the_opening" && !includeOpening) {
      return;
    }
    lines.push(describe(label, key, totalRounds));
  });

  lines.push("#GuessSenpai");

  const allCompleted = requiredKeys.every((key) => progress[key]?.completed);
  const shareUrls = [
    ...(options?.aniListUrls ?? []),
    ...(options?.aniListUrl ? [options.aniListUrl] : []),
  ].filter((url): url is string => Boolean(url));
  const uniqueUrls = Array.from(new Set(shareUrls));
  if (allCompleted && uniqueUrls.length > 0) {
    lines.push("", ...uniqueUrls);
  }

  return lines.join("\n");
}
