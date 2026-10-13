export function getNextResetIso(referenceIso?: string | null): string | null {
  try {
    if (referenceIso) {
      const hasTimePortion = referenceIso.includes("T");
      const baseInput = hasTimePortion
        ? referenceIso
        : `${referenceIso}T00:00:00.000Z`;
      const base = new Date(baseInput);
      if (Number.isNaN(base.getTime())) {
        return null;
      }
      const next = new Date(base.getTime());
      next.setUTCDate(base.getUTCDate() + 1);
      next.setUTCHours(0, 0, 0, 0);
      return next.toISOString();
    }

    const now = new Date();
    const next = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
        0,
        0,
        0,
        0,
      ),
    );
    return next.toISOString();
  } catch {
    return null;
  }
}

export function formatDurationFromMs(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hoursPart = hours.toString().padStart(2, "0");
  const minutesPart = minutes.toString().padStart(2, "0");
  const secondsPart = seconds.toString().padStart(2, "0");

  return `${hoursPart}:${minutesPart}:${secondsPart}`;
}

/**
 * Milliseconds from `now` to the next 00:00 UTC. Always in (0, 24h]; it does
 * not depend on the puzzle payload, whose `reset_at` can arrive without a
 * timezone suffix and then be misread as local time (hours over 24).
 */
export function getMsUntilNextUtcMidnight(now: number = Date.now()): number {
  const date = new Date(now);
  const next = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + 1,
  );
  return next - now;
}
