import {
  DailyProgress,
  GameKey,
  GameProgress,
  GameRoundProgress,
} from "../types/progress";

const GAME_DESCRIPTORS: Array<{
  label: string;
  key: GameKey;
  totalRounds: number;
}> = [
  { label: "Anidle", key: "anidle", totalRounds: 3 },
  { label: "Poster Zoomed", key: "poster_zoomed", totalRounds: 3 },
  { label: "Character Silhouette", key: "character_silhouette", totalRounds: 3 },
  { label: "Redacted Synopsis", key: "redacted_synopsis", totalRounds: 3 },
  { label: "Guess the Opening", key: "guess_the_opening", totalRounds: 3 },
];

export interface ShareEventOptions {
  includeGuessTheOpening?: boolean;
  aniListUrls?: string[];
  /** @deprecated use aniListUrls */
  aniListUrl?: string;
}

export type ShareRoundState = "locked" | "active" | "cleared";

export interface ShareEventRound {
  round: number;
  state: ShareRoundState;
}

export type ShareGameStatus = "pending" | "in_progress" | "completed";

export interface ShareEventGame {
  key: GameKey;
  label: string;
  totalRounds: number;
  status: ShareGameStatus;
  summary: string;
  attempts?: number;
  rounds: ShareEventRound[];
}

export interface ShareEventData {
  schema: "guesssenpai.share.v1";
  date: string;
  formattedDate: string;
  includeGuessTheOpening: boolean;
  games: ShareEventGame[];
  tags: string[];
  externalUrls: string[];
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

function buildRoundStates(
  totalRounds: number,
  progress: GameProgress | null | undefined,
): ShareEventRound[] {
  const rounds: ShareEventRound[] = [];

  if (!progress) {
    for (let index = 1; index <= totalRounds; index += 1) {
      rounds.push({ round: index, state: "locked" });
    }
    return rounds;
  }

  if (progress.completed) {
    for (let index = 1; index <= totalRounds; index += 1) {
      rounds.push({ round: index, state: "cleared" });
    }
    return rounds;
  }

  if (progress.rounds && progress.rounds.length > 0) {
    const map = new Map<number, GameRoundProgress>();
    progress.rounds.forEach((entry) => {
      if (!entry) return;
      const normalizedRound = Number.isFinite(entry.round)
        ? Math.max(1, Math.floor(entry.round))
        : null;
      if (!normalizedRound) return;
      map.set(normalizedRound, entry);
    });

    let activeMarked = false;
    for (let index = 1; index <= totalRounds; index += 1) {
      const stored = map.get(index);
      if (stored?.completed) {
        rounds.push({ round: index, state: "cleared" });
        continue;
      }
      if (!activeMarked) {
        rounds.push({ round: index, state: "active" });
        activeMarked = true;
        continue;
      }
      rounds.push({ round: index, state: "locked" });
    }

    if (!activeMarked && rounds.length > 0) {
      const lastIndex = rounds.length - 1;
      rounds[lastIndex] = { ...rounds[lastIndex], state: "active" };
    }

    return rounds;
  }

  const unlockedRounds = Math.max(1, Math.min(totalRounds, progress.round ?? 1));

  for (let index = 1; index <= totalRounds; index += 1) {
    if (index < unlockedRounds) {
      rounds.push({ round: index, state: "cleared" });
    } else if (index === unlockedRounds) {
      rounds.push({ round: index, state: "active" });
    } else {
      rounds.push({ round: index, state: "locked" });
    }
  }

  return rounds;
}

function collectPosterAttemptBreakdown(rounds?: GameRoundProgress[]) {
  const normalized = Array.isArray(rounds)
    ? rounds.filter((entry): entry is GameRoundProgress => Boolean(entry))
    : [];

  let titleAttempts = 0;
  let yearAttempts = 0;

  normalized.forEach((round) => {
    const titleSource = Array.isArray(round.titleGuesses)
      ? round.titleGuesses
      : round.guesses;
    titleAttempts += titleSource?.length ?? 0;
    yearAttempts += round.yearGuesses?.length ?? 0;
  });

  const attemptSummaryParts: string[] = [];
  if (titleAttempts > 0) {
    attemptSummaryParts.push(
      `${titleAttempts} title ${titleAttempts === 1 ? "guess" : "guesses"}`,
    );
  }
  if (yearAttempts > 0) {
    attemptSummaryParts.push(
      `${yearAttempts} year ${yearAttempts === 1 ? "guess" : "guesses"}`,
    );
  }

  return {
    titleAttempts,
    yearAttempts,
    totalAttempts: titleAttempts + yearAttempts,
    attemptSummary: attemptSummaryParts.join(" · "),
  };
}

export function buildShareEvent(
  dateIso: string,
  progress: DailyProgress,
  options?: ShareEventOptions,
): ShareEventData {
  const formattedDate = formatShareDate(dateIso);
  const includeOpening = options?.includeGuessTheOpening ?? false;
  const tags = ["#GuessSenpai"];

  const externalUrls = [
    ...(options?.aniListUrls ?? []),
    ...(options?.aniListUrl ? [options.aniListUrl] : []),
  ]
    .filter((url): url is string => Boolean(url))
    .filter((value, index, array) => array.indexOf(value) === index);

  const games: ShareEventGame[] = GAME_DESCRIPTORS.filter(({ key }) => {
    if (key === "guess_the_opening" && !includeOpening) {
      return false;
    }
    return true;
  }).map(({ key, label, totalRounds }) => {
    const gameProgress = progress[key];

    if (key === "anidle") {
      const attempts = Math.max(0, gameProgress?.guesses?.length ?? 0);

      if (!gameProgress) {
        return {
          key,
          label,
          totalRounds,
          status: "pending" as const,
          attempts,
          rounds: [],
          summary: `${label} — ⏳`,
        };
      }

      if (gameProgress.completed) {
        const completedAttempts = Math.max(1, attempts);
        const attemptLabel = completedAttempts === 1 ? "try" : "tries";
        return {
          key,
          label,
          totalRounds,
          status: "completed" as const,
          attempts: completedAttempts,
          rounds: [],
          summary: `${label} — ${completedAttempts} ${attemptLabel} ✅`,
        };
      }

      if (attempts > 0) {
        const attemptLabel = attempts === 1 ? "try" : "tries";
        return {
          key,
          label,
          totalRounds,
          status: "in_progress" as const,
          attempts,
          rounds: [],
          summary: `${label} — ${attempts} ${attemptLabel}`,
        };
      }

      return {
        key,
        label,
        totalRounds,
        status: "in_progress" as const,
        attempts,
        rounds: [],
        summary: `${label} — In progress`,
      };
    }

    const rounds = buildRoundStates(totalRounds, gameProgress);
    const clearedRounds = rounds.filter((round) => round.state === "cleared").length;

    if (!gameProgress) {
      return {
        key,
        label,
        totalRounds,
        status: "pending" as const,
        rounds,
        summary: `${label} — ⏳`,
      };
    }

    if (key === "poster_zoomed") {
      const posterRounds = (gameProgress.rounds ?? []).filter(
        (entry): entry is GameRoundProgress => Boolean(entry),
      );
      const clearedFromProgress = posterRounds.reduce(
        (count, entry) => (entry.completed ? count + 1 : count),
        0,
      );
      const resolvedCleared = Math.max(
        clearedFromProgress,
        rounds.filter((round) => round.state === "cleared").length,
      );
      const { totalAttempts, attemptSummary } = collectPosterAttemptBreakdown(
        posterRounds,
      );
      const totalRoundLabel = totalRounds === 1 ? "round" : "rounds";
      const clearedRoundLabel = resolvedCleared === 1 ? "round" : "rounds";

      const baseSummary = gameProgress.completed
        ? `${label} — ✅ (${totalRounds}/${totalRounds} ${totalRoundLabel})`
        : `${label} — ${resolvedCleared}/${totalRounds} ${clearedRoundLabel}`;
      const summary = attemptSummary
        ? `${baseSummary} · ${attemptSummary}`
        : baseSummary;

      return {
        key,
        label,
        totalRounds,
        status: gameProgress.completed ? ("completed" as const) : ("in_progress" as const),
        rounds,
        attempts: totalAttempts > 0 ? totalAttempts : undefined,
        summary,
      };
    }

    if (key === "guess_the_opening") {
      const openingLabel = clearedRounds === 1 ? "opening" : "openings";

      if (gameProgress.completed) {
        return {
          key,
          label,
          totalRounds,
          status: "completed" as const,
          rounds,
          summary: `${label} — ✅ (${totalRounds}/${totalRounds} openings)`,
        };
      }

      return {
        key,
        label,
        totalRounds,
        status: "in_progress" as const,
        rounds,
        summary: `${label} — ${clearedRounds}/${totalRounds} ${openingLabel}`,
      };
    }

    if (gameProgress.completed) {
      return {
        key,
        label,
        totalRounds,
        status: "completed" as const,
        rounds,
        summary: `${label} — ✅ (${clearedRounds}/${totalRounds})`,
      };
    }

    return {
      key,
      label,
      totalRounds,
      status: "in_progress" as const,
      rounds,
      summary: `${label} — ${clearedRounds}/${totalRounds}`,
    };
  });

  return {
    schema: "guesssenpai.share.v1",
    date: dateIso,
    formattedDate,
    includeGuessTheOpening: includeOpening,
    games,
    tags,
    externalUrls,
  };
}

export function formatShareEventMessage(event: ShareEventData): string {
  const lines: string[] = [];
  lines.push(`GuessSenpai — ${event.formattedDate}`);

  event.games.forEach((game) => {
    lines.push(game.summary);
  });

  event.tags.forEach((tag) => {
    if (!lines.includes(tag)) {
      lines.push(tag);
    }
  });

  if (event.externalUrls.length > 0) {
    lines.push("", ...event.externalUrls);
  }

  return lines.join("\n");
}
