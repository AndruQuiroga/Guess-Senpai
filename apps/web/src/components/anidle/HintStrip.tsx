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

export interface HintOffer {
  /** Hints earned but not yet revealed. */
  pending: number;
  used: number;
  total: number;
  /** Wrong guesses until the next hint is earned; null when none remain. */
  nextHintIn: number | null;
  onReveal(): void;
}

interface HintStripProps {
  hints: AggregatedHint[];
  /** Rules v2 opt-in hints. Without it, every hint passed is shown. */
  offer?: HintOffer | null;
}

function HintOfferBar({ offer }: { offer: HintOffer }) {
  const status =
    offer.pending > 0
      ? `${offer.pending === 1 ? "A hint is" : `${offer.pending} hints are`} available.`
      : offer.nextHintIn != null
        ? `Next hint available after ${offer.nextHintIn} more wrong ${
            offer.nextHintIn === 1 ? "guess" : "guesses"
          }.`
        : "No hints left.";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <p className="text-muted">
        <span className="font-semibold text-paper">
          Hints {offer.used}/{offer.total}
        </span>{" "}
        · {status}
      </p>
      {offer.pending > 0 ? (
        <button
          type="button"
          onClick={offer.onReveal}
          className="inline-flex items-center rounded-md border border-signal bg-signal-soft px-3 py-1 text-sm font-semibold text-paper transition hover:bg-hover"
        >
          Reveal hint
        </button>
      ) : null}
    </div>
  );
}

/**
 * Hint area below the input. With an offer (rules v2) hints are opt-in: the
 * bar says when one is available and nothing is shown until it is revealed.
 */
export function HintStrip({ hints, offer = null }: HintStripProps) {
  if (hints.length === 0 && !offer) return null;
  if (hints.length === 0 && offer) {
    return (
      <section
        aria-label="Hint options"
        className="rounded-md border border-line bg-panel px-3 py-2"
      >
        <HintOfferBar offer={offer} />
      </section>
    );
  }
  return (
    <section
      aria-label="Hints"
      className="space-y-2 rounded-md border border-signal-deep bg-signal-soft px-3 py-3"
    >
      {offer ? <HintOfferBar offer={offer} /> : null}
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
