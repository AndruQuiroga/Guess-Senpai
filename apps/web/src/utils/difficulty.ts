export type DifficultyLevel = 1 | 2 | 3;

function clampDifficultyLevel(level: number | null | undefined): DifficultyLevel | null {
  if (level === null || level === undefined) {
    return null;
  }

  if (!Number.isFinite(level)) {
    return null;
  }

  const rounded = Math.round(level);
  if (Number.isNaN(rounded)) {
    return null;
  }

  if (rounded <= 1) return 1;
  if (rounded >= 3) return 3;
  return 2;
}

const DIFFICULTY_OFFSETS: Record<DifficultyLevel, number> = {
  1: 1,
  2: 0,
  3: -1,
};

export function getDifficultyRoundOffset(level: number | null | undefined): number {
  const difficulty = clampDifficultyLevel(level);
  if (!difficulty) {
    return 0;
  }
  return DIFFICULTY_OFFSETS[difficulty];
}

export function resolveHintRound(
  round: number,
  totalRounds: number,
  difficulty: number | null | undefined,
): number {
  if (!Number.isFinite(totalRounds) || totalRounds <= 0) {
    return 1;
  }

  const normalizedRound = Number.isFinite(round) ? Math.round(round) : 1;
  const clampedRound = Math.max(1, Math.min(totalRounds, normalizedRound));
  const adjusted = clampedRound + getDifficultyRoundOffset(difficulty);
  return Math.max(1, Math.min(totalRounds, adjusted));
}
