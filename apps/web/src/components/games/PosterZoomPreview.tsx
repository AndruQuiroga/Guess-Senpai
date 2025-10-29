import type { PosterZoomPuzzleBundle } from "../../types/puzzles";
import type { GameProgress, GameRoundProgress } from "../../types/progress";

interface PosterZoomPreviewProps {
  bundle?: PosterZoomPuzzleBundle | null;
  progress?: GameProgress | null;
}

const HINT_LABELS: Record<string, string> = {
  genres: "Genres",
  season: "Season",
  format: "Format",
  year: "Year",
};

type PosterRound = PosterZoomPuzzleBundle["puzzle"]["rounds"][number];

type RoundState = "cleared" | "active" | "locked";

const STATUS_LABELS: Record<RoundState, string> = {
  cleared: "Cleared",
  active: "In progress",
  locked: "Locked",
};

const STATUS_TONES: Record<RoundState, string> = {
  cleared: "text-emerald-200",
  active: "text-amber-200",
  locked: "text-neutral-400",
};

function formatHintLabel(value: string) {
  return HINT_LABELS[value] ?? value.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function normalizeSeason(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function formatReleaseSummary(
  roundProgress: GameRoundProgress | undefined,
  round: PosterRound | undefined,
): string | null {
  const season = normalizeSeason(roundProgress?.seasonGuess ?? round?.meta?.season ?? null);
  const resolvedYear =
    roundProgress?.resolvedYear ??
    roundProgress?.seasonYearGuess ??
    (typeof round?.meta?.year === "number" ? round?.meta?.year : null);

  const parts: string[] = [];
  if (season) {
    parts.push(season);
  }
  if (resolvedYear !== undefined && resolvedYear !== null) {
    parts.push(String(resolvedYear));
  }

  if (parts.length > 0) {
    return parts.join(" · ");
  }

  return null;
}

function formatAttemptSummary(roundProgress: GameRoundProgress | undefined): string | null {
  if (!roundProgress) return null;
  const titleAttemptsSource = Array.isArray(roundProgress.titleGuesses)
    ? roundProgress.titleGuesses
    : roundProgress.guesses;
  const titleAttempts = titleAttemptsSource?.length ?? 0;
  const yearAttempts = roundProgress.yearGuesses?.length ?? 0;

  const parts: string[] = [];
  if (titleAttempts > 0) {
    parts.push(`${titleAttempts} title ${titleAttempts === 1 ? "guess" : "guesses"}`);
  }
  if (yearAttempts > 0) {
    parts.push(`${yearAttempts} year ${yearAttempts === 1 ? "guess" : "guesses"}`);
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

function collectRoundProgress(progress?: GameProgress | null) {
  const map = new Map<number, GameRoundProgress>();
  progress?.rounds?.forEach((entry) => {
    if (!entry) return;
    const normalizedRound = Number.isFinite(entry.round)
      ? Math.max(1, Math.floor(entry.round))
      : null;
    if (!normalizedRound) return;
    map.set(normalizedRound, entry);
  });
  return map;
}

function determineActiveRound(
  totalRounds: number,
  progress: GameProgress | null | undefined,
  completedRounds: Set<number>,
): number {
  if (!totalRounds) return 1;
  if (!progress) return 1;
  if (progress.completed) return totalRounds;

  for (let index = 1; index <= totalRounds; index += 1) {
    if (!completedRounds.has(index)) {
      return index;
    }
  }

  const normalizedRound = Number.isFinite(progress.round)
    ? Math.max(1, Math.min(totalRounds, Math.floor(progress.round)))
    : 1;

  return normalizedRound;
}

function resolveRoundState(
  roundNumber: number,
  activeRound: number,
  completedRounds: Set<number>,
): RoundState {
  if (completedRounds.has(roundNumber)) {
    return "cleared";
  }
  if (roundNumber === activeRound) {
    return "active";
  }
  if (roundNumber < activeRound) {
    return "cleared";
  }
  return "locked";
}

export function PosterZoomPreview({ bundle, progress }: PosterZoomPreviewProps) {
  if (!bundle) return null;

  const puzzleRounds = bundle.puzzle.rounds ?? [];
  const specRounds = bundle.puzzle.spec ?? [];
  const totalRounds = Math.max(puzzleRounds.length, specRounds.length, 3);
  const roundProgressMap = collectRoundProgress(progress);
  const completedRounds = new Set<number>();
  roundProgressMap.forEach((entry, key) => {
    if (entry?.completed) {
      completedRounds.add(key);
    }
  });

  const activeRound = determineActiveRound(totalRounds, progress, completedRounds);

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-100/90">
        Three posters per day. Clear each round to reveal its release details.
      </p>

      <ul className="space-y-3">
        {Array.from({ length: totalRounds }, (_, index) => {
          const roundNumber = index + 1;
          const roundProgress = roundProgressMap.get(roundNumber);
          const round = puzzleRounds[index];
          const hints = specRounds[index]?.hints ?? [];
          const state = resolveRoundState(roundNumber, activeRound, completedRounds);
          const releaseSummary =
            state === "cleared" ? formatReleaseSummary(roundProgress, round) : null;
          const attemptSummary = formatAttemptSummary(roundProgress);

          return (
            <li
              key={round ? `${round.mediaId}-${roundNumber}` : `round-${roundNumber}`}
              className="rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.28em] text-neutral-300">
                <span>Poster {roundNumber}</span>
                <span className={STATUS_TONES[state]}>{STATUS_LABELS[state]}</span>
              </div>

              <div className="mt-3 space-y-2 text-xs text-neutral-300/90">
                {releaseSummary ? (
                  <p className="text-neutral-100/90">Release {releaseSummary}</p>
                ) : (
                  <p className="text-neutral-300/80">
                    {state === "cleared"
                      ? "Release info unlocked."
                      : state === "active"
                        ? "Work through the zoom levels to reveal the title and release."
                        : "Clear earlier rounds to unlock this poster."}
                  </p>
                )}

                {attemptSummary ? (
                  <p className="text-[0.7rem] uppercase tracking-[0.24em] text-neutral-300/70">
                    Attempts: {attemptSummary}
                  </p>
                ) : null}

                {hints.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 text-[0.7rem] uppercase tracking-wide text-neutral-200/80">
                    {hints.map((hint) => (
                      <span
                        key={hint}
                        className="rounded-full border border-white/10 bg-white/10 px-3 py-1 font-semibold text-white/80"
                      >
                        {formatHintLabel(hint)}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

