"use client";

import { useEffect, useRef } from "react";

import type { CharacterGuessRound } from "../../../types/puzzles";
import type { CharacterRoundState } from "./types";

interface RoundSummaryModalProps {
  roundIndex: number;
  roundState: CharacterRoundState;
  roundData: CharacterGuessRound | null;
  totalRounds: number;
  totalSolved: number;
  totalEntries: number;
  onContinue(): void;
}

export function RoundSummaryModal({
  roundIndex,
  roundState,
  roundData,
  totalRounds,
  totalSolved,
  totalEntries,
  onContinue,
}: RoundSummaryModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const isFinalRound = roundIndex + 1 >= totalRounds;

  const attemptsForRound = roundState.entries.reduce(
    (sum, entry) => sum + entry.history.length,
    0,
  );

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus({ preventScroll: true });
    return () => {
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="round-summary-heading"
        tabIndex={-1}
        className="w-full max-w-xl space-y-6 rounded-3xl border border-white/12 bg-surface-raised px-6 py-8 text-white shadow-ambient"
      >
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.28em] text-brand-200/80">
            Round {roundIndex + 1} complete
          </p>
          <h2 id="round-summary-heading" className="text-2xl font-display font-semibold tracking-tight">
            {roundData?.entries?.[0]?.reveal?.label ?? "Silhouette reveal cleared"}
          </h2>
          {roundData?.entries?.[0]?.reveal?.description ? (
            <p className="text-sm text-white/80">{roundData.entries[0].reveal.description}</p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
          <ul className="grid gap-3 sm:grid-cols-2">
            <li className="space-y-1">
              <p className="text-xs uppercase tracking-[0.2em] text-white/60">Characters revealed</p>
              <p className="text-base font-semibold text-white">
                {roundState.entries.length}
              </p>
            </li>
            <li className="space-y-1">
              <p className="text-xs uppercase tracking-[0.2em] text-white/60">Attempts this round</p>
              <p className="text-base font-semibold text-white">{attemptsForRound}</p>
            </li>
            <li className="space-y-1">
              <p className="text-xs uppercase tracking-[0.2em] text-white/60">Total solved</p>
              <p className="text-base font-semibold text-white">
                {totalSolved} / {totalEntries}
              </p>
            </li>
            <li className="space-y-1">
              <p className="text-xs uppercase tracking-[0.2em] text-white/60">Rounds remaining</p>
              <p className="text-base font-semibold text-white">
                {Math.max(totalRounds - (roundIndex + 1), 0)}
              </p>
            </li>
          </ul>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-white/80">
            {isFinalRound
              ? "You cleared every silhouette in the lineup!"
              : "Ready for a brighter reveal? The next lineup is waiting."}
          </p>

          <button
            type="button"
            onClick={onContinue}
            className="w-full rounded-2xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_6px_20px_rgba(59,130,246,0.35)] transition hover:bg-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:ring-offset-2 focus:ring-offset-black"
          >
            {isFinalRound ? "View results" : "Advance to the next round"}
          </button>
        </div>
      </div>
    </div>
  );
}

