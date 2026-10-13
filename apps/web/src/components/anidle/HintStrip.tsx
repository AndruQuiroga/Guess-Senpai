import type { ReactNode } from "react";

import type { AggregatedHint } from "./hints";

const REDACTED_TOKEN = "[REDACTED]";
// The synopsis keeps one token per hidden word and drops its length, so bar
// widths cycle through plausible word lengths rather than leaking anything.
const BAR_WIDTHS_CH = [5, 7, 4, 8, 6, 3, 7, 5];

/** Renders synopsis text with each redacted word as an inline black bar. */
export function RedactedText({ text }: { text: string }) {
  const parts = text.split(REDACTED_TOKEN);
  const nodes: ReactNode[] = [];
  parts.forEach((part, index) => {
    if (part) nodes.push(part);
    if (index < parts.length - 1) {
      nodes.push(
        <span
          key={`bar-${index}`}
          role="img"
          aria-label="redacted"
          data-redacted
          className="mx-0.5 inline-block h-[0.95em] rounded-sm bg-ink align-[-0.12em] ring-1 ring-line"
          style={{ width: `${BAR_WIDTHS_CH[index % BAR_WIDTHS_CH.length]}ch` }}
        />,
      );
    }
  });
  return <>{nodes}</>;
}

interface HintStripProps {
  hints: AggregatedHint[];
}

/**
 * Revealed hints, shown below the input. Rules-v2 hints are bought from the
 * clue panel; this only displays what has been revealed.
 */
export function HintStrip({ hints }: HintStripProps) {
  if (hints.length === 0) return null;
  return (
    <section
      aria-label="Hints"
      className="space-y-2 rounded-md border border-signal-deep bg-signal-soft px-3 py-3"
    >
      {hints.map((hint) => {
        if (hint.type === "synopsis") {
          return (
            <div key={`synopsis-${hint.ratio}`}>
              <p className="flex flex-wrap items-baseline justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-signal-text">
                <span>{hint.label}</span>
                <span className="normal-case text-muted">
                  {Math.round(hint.ratio * 100)}% revealed
                </span>
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-paper">
                <RedactedText text={hint.text} />
              </p>
            </div>
          );
        }
        return (
          <div
            key={`${hint.label}-${hint.type === "tags" ? hint.values.join("|") : hint.value}`}
            className="flex flex-wrap items-center gap-1.5 text-sm"
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-signal-text">
              {hint.label}
            </span>
            {hint.type === "tags" ? (
              hint.values.map((value) => (
                <span
                  key={value}
                  className="rounded border border-line-strong bg-panel-raised px-2 py-0.5 font-medium text-paper"
                >
                  {value}
                </span>
              ))
            ) : (
              <span className="rounded border border-line-strong bg-panel-raised px-2 py-0.5 font-medium text-paper">
                {hint.value}
              </span>
            )}
          </div>
        );
      })}
    </section>
  );
}
