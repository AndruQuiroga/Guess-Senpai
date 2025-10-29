import { addDays } from "date-fns";

import type { StreakSnapshot } from "../types/streak";

function parseIsoDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  try {
    const parsed = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function computeNextStreakSnapshot(
  previous: StreakSnapshot,
  currentDateIso: string,
): StreakSnapshot {
  if (!currentDateIso) {
    return previous;
  }
  if (previous.lastCompleted === currentDateIso) {
    return previous;
  }

  const today = parseIsoDate(currentDateIso);
  if (!today) {
    return previous;
  }

  const previousDate = parseIsoDate(previous.lastCompleted);
  if (!previousDate) {
    return { count: 1, lastCompleted: currentDateIso };
  }

  const expected = addDays(previousDate, 1);
  const isConsecutive =
    expected.getUTCFullYear() === today.getUTCFullYear() &&
    expected.getUTCMonth() === today.getUTCMonth() &&
    expected.getUTCDate() === today.getUTCDate();

  const baseCount = Number.isFinite(previous.count) ? previous.count : 0;
  const nextCount = isConsecutive ? baseCount + 1 : 1;

  return { count: nextCount, lastCompleted: currentDateIso };
}

export function projectStreakSnapshot(
  base: StreakSnapshot,
  currentDateIso: string,
  completed: boolean,
): StreakSnapshot {
  if (!completed) {
    return base;
  }
  return computeNextStreakSnapshot(base, currentDateIso);
}
