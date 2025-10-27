import React from "react";

interface DailyResetTimerProps {
  timeRemaining: string | null;
}

function getDisplaySegments(value: string | null): string[] {
  if (!value) {
    return ["—", "—", ":", "—", "—", ":", "—", "—"];
  }

  return value.split("");
}

export function DailyResetTimer({
  timeRemaining,
}: DailyResetTimerProps): JSX.Element {
  const characters = getDisplaySegments(timeRemaining);

  const displayValue = timeRemaining ?? "--:--:--";

  return (
    <div
      className="flex flex-col items-center gap-3 text-white"
      role="timer"
      aria-live="polite"
      aria-label={`Daily reset timer ${displayValue}`}
    >
      <div className="flex w-full items-center justify-center gap-2">
        {characters.map((char, index) => {
          if (char === ":") {
            return (
              <span
                key={`separator-${index}`}
                className="px-1 text-3xl font-bold text-white/80 sm:text-4xl md:text-5xl"
                aria-hidden
              >
                {char}
              </span>
            );
          }

          return (
            <span
              key={`segment-${index}`}
              className="inline-flex min-w-[2.25rem] items-center justify-center rounded-xl bg-white/10 px-2 py-3 font-mono text-3xl font-semibold tracking-[0.2em] text-white shadow-inner transition sm:min-w-[2.75rem] sm:text-4xl md:min-w-[3rem] md:text-5xl"
            >
              {char}
            </span>
          );
        })}
      </div>
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-white/60">
        Resets at 00:00 UTC
      </p>
    </div>
  );
}

export default DailyResetTimer;
