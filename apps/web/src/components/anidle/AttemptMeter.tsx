interface AttemptMeterProps {
  /** Accepted guesses so far. */
  used: number;
  max: number;
  /** Misses after which a hint unlocks (for example 2, 4, 6). */
  hintAfter?: number[];
  /** Number shown as "Guess n / max". Defaults to the next guess. */
  position?: number;
  finished?: boolean;
}

/** "Guess n / 8" plus one pip per attempt, ringed where a hint unlocks. */
export function AttemptMeter({
  used,
  max,
  hintAfter = [],
  position,
  finished = false,
}: AttemptMeterProps) {
  const shown = Math.min(position ?? (finished ? used : used + 1), max);
  const pips = Array.from({ length: max }, (_, index) => index + 1);
  return (
    <span className="inline-flex items-center gap-3">
      <span>
        Guess {shown} / {max}
      </span>
      <span
        className="inline-flex items-center gap-1"
        role="img"
        aria-label={`${used} of ${max} guesses used. Hints unlock after ${hintAfter.join(", ")} wrong guesses.`}
      >
        {pips.map((n) => {
          const hint = hintAfter.includes(n);
          const state = n <= used ? "used" : "open";
          return (
            <span
              key={n}
              data-pip={state}
              data-hint={hint ? "true" : undefined}
              className={`relative h-2.5 w-2.5 rounded-full border ${
                state === "used"
                  ? "border-signal bg-signal"
                  : "border-line-strong bg-ink"
              } ${hint ? "outline outline-1 outline-offset-2 outline-signal-text" : ""}`}
            />
          );
        })}
      </span>
    </span>
  );
}
