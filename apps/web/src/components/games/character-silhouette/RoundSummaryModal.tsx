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
    const previousOverflow = document.body.style.overflow;
    const main = document.querySelector("main");
    const previousInert = main?.inert ?? false;
    if (main && !main.contains(dialogRef.current)) main.inert = true;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus({ preventScroll: true });
    const containFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const button =
        dialogRef.current?.querySelector<HTMLButtonElement>("button");
      if (button) {
        event.preventDefault();
        button.focus();
      }
    };
    document.addEventListener("keydown", containFocus);
    return () => {
      document.removeEventListener("keydown", containFocus);
      document.body.style.overflow = previousOverflow;
      if (main) main.inert = previousInert;
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="round-summary-heading"
        tabIndex={-1}
        className="max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto overscroll-contain space-y-6 rounded-lg border border-[#686b6d] bg-[#242628] px-5 py-6 text-white"
      >
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-[0.28em] text-[#c1c2bd]">
            Round {roundIndex + 1} complete
          </p>
          <h2
            id="round-summary-heading"
            className="text-2xl font-display font-semibold tracking-tight"
          >
            {roundData?.entries?.[0]?.reveal?.label ??
              "Silhouette reveal cleared"}
          </h2>
          {roundData?.entries?.[0]?.reveal?.description ? (
            <p className="text-sm text-[#f4f0e7]">
              {roundData.entries[0].reveal.description}
            </p>
          ) : null}
        </div>

        <div className="rounded-lg border border-[#686b6d] bg-[#2c2f31] p-4 text-sm text-[#f4f0e7]">
          <ul className="grid gap-3 sm:grid-cols-2">
            <li className="space-y-1">
              <p className="text-sm uppercase tracking-[0.2em] text-[#c1c2bd]">
                Characters revealed
              </p>
              <p className="text-base font-semibold text-white">
                {roundState.entries.length}
              </p>
            </li>
            <li className="space-y-1">
              <p className="text-sm uppercase tracking-[0.2em] text-[#c1c2bd]">
                Attempts this round
              </p>
              <p className="text-base font-semibold text-white">
                {attemptsForRound}
              </p>
            </li>
            <li className="space-y-1">
              <p className="text-sm uppercase tracking-[0.2em] text-[#c1c2bd]">
                Total solved
              </p>
              <p className="text-base font-semibold text-white">
                {totalSolved} / {totalEntries}
              </p>
            </li>
            <li className="space-y-1">
              <p className="text-sm uppercase tracking-[0.2em] text-[#c1c2bd]">
                Rounds remaining
              </p>
              <p className="text-base font-semibold text-white">
                {Math.max(totalRounds - (roundIndex + 1), 0)}
              </p>
            </li>
          </ul>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-[#f4f0e7]">
            {isFinalRound
              ? "You cleared every silhouette in the lineup!"
              : "Ready for a brighter reveal? The next lineup is waiting."}
          </p>

          <button
            type="button"
            onClick={onContinue}
            className="w-full rounded-lg bg-[#ff7658] px-4 py-3 text-base font-semibold text-[#27110b]  transition hover:bg-[#ff8a70]  focus:ring-2 focus:ring-brand-300 focus:ring-offset-2 focus:ring-offset-black"
          >
            {isFinalRound ? "View results" : "Advance to the next round"}
          </button>
        </div>
      </div>
    </div>
  );
}
