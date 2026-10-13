"use client";

import Link from "next/link";
import { useState } from "react";

import type { AnidleGuessEvaluation } from "../../types/anidle";
import { getPuzzleTitleFromSlug } from "../../utils/puzzleTitles";
import { evaluationTones, TONE_SWATCH } from "./tiles";

interface ResultCardProps {
  solved: boolean;
  answer: string;
  attempts: number;
  /** Rules v2 attempt budget; null for legacy unlimited play. */
  maxAttempts: number | null;
  evaluations: (AnidleGuessEvaluation | null)[];
  nextSlug?: string | null;
  coverImage?: string | null;
  /**
   * Unlimited practice: the primary action is a "New puzzle" button instead of
   * the link to the next daily mode, and the share text is not about today.
   */
  onNewPuzzle?: () => void;
  newPuzzleBusy?: boolean;
}

export function buildShareText(
  solved: boolean,
  attempts: number,
  maxAttempts: number | null,
  practice = false,
): string {
  if (practice) {
    return solved
      ? `I solved an Unlimited Anidle puzzle in ${attempts} ${attempts === 1 ? "guess" : "guesses"}.`
      : `Unlimited Anidle: ${attempts}/${maxAttempts} guesses, answer revealed.`;
  }
  if (solved) {
    return `I solved today's Anidle puzzle in ${attempts} ${attempts === 1 ? "guess" : "guesses"}.`;
  }
  return `Today's Anidle: ${attempts}/${maxAttempts} guesses, answer revealed. Try the same daily puzzle.`;
}

/** Shared by the solve and out-of-guesses outcomes; reveals the answer. */
export function ResultCard({
  solved,
  answer,
  attempts,
  maxAttempts,
  evaluations,
  nextSlug,
  coverImage,
  onNewPuzzle,
  newPuzzleBusy = false,
}: ResultCardProps) {
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const headline = solved
    ? maxAttempts
      ? `Solved in ${attempts}/${maxAttempts}`
      : `Solved in ${attempts} ${attempts === 1 ? "attempt" : "attempts"}`
    : "Out of guesses";
  const nextTitle = getPuzzleTitleFromSlug(nextSlug);
  const rows = evaluations.filter((entry): entry is AnidleGuessEvaluation =>
    Boolean(entry),
  );

  const share = async () => {
    const text = buildShareText(
      solved,
      attempts,
      maxAttempts,
      Boolean(onNewPuzzle),
    );
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        setShareMessage("Spoiler-free share text copied.");
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        setShareMessage("Share could not be opened. Your result is saved.");
      }
    }
  };

  return (
    <section className="space-y-4 rounded-md border border-signal-deep bg-signal-soft p-4">
      <div className="flex items-start gap-4" role="status" aria-live="polite">
        {coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverImage}
            alt=""
            width={72}
            height={100}
            className="h-24 w-[4.5rem] shrink-0 rounded-sm object-cover"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-signal-text">
            {headline}
            {solved ? null : " · Answer revealed"}
          </p>
          <p className="mt-1 break-words font-display text-2xl font-bold text-paper">
            {answer}
          </p>
        </div>
        {rows.length > 0 ? (
          <div
            role="img"
            aria-label={`Your ${rows.length} ${rows.length === 1 ? "guess" : "guesses"} as colour rows`}
            className="grid shrink-0 gap-0.5"
          >
            {rows.map((entry, index) => (
              <div key={index} className="flex gap-0.5">
                {evaluationTones(entry).map((tone, column) => (
                  <span
                    key={column}
                    data-tone={tone}
                    className={`h-2.5 w-2.5 rounded-sm ${TONE_SWATCH[tone]}`}
                  />
                ))}
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="button border border-line-strong bg-panel-raised text-paper hover:bg-hover"
          onClick={share}
        >
          Share result
        </button>
        {onNewPuzzle ? (
          <button
            type="button"
            className="button button-primary"
            onClick={onNewPuzzle}
            disabled={newPuzzleBusy}
          >
            New puzzle
            <span aria-hidden>→</span>
          </button>
        ) : (
          <Link
            href={nextSlug ? `/games/${nextSlug}` : "/"}
            className="button button-primary"
          >
            {nextSlug ? "Next puzzle" : "Back to Today"}
            {nextTitle ? <span className="sr-only">: {nextTitle}</span> : null}
            <span aria-hidden>→</span>
          </Link>
        )}
      </div>
      {shareMessage ? (
        <p role="status" className="text-sm text-muted">
          {shareMessage}
        </p>
      ) : null}
    </section>
  );
}
