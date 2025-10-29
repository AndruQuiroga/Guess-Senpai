"use client";

import { useCallback, useEffect, useMemo } from "react";

import type { GameProgress } from "../hooks/usePuzzleProgress";
import type { CharacterSilhouetteGame } from "../types/puzzles";
import NextPuzzleButton from "./NextPuzzleButton";
import { CharacterCard } from "./games/character-silhouette/CharacterCard";
import { RoundSummaryModal } from "./games/character-silhouette/RoundSummaryModal";
import { useCharacterSilhouetteGame } from "./games/character-silhouette/useCharacterSilhouetteGame";
import type { FeedbackState } from "./games/character-silhouette/types";
import { verifyGuess } from "../utils/verifyGuess";

interface Props {
  mediaId: number;
  payload: CharacterSilhouetteGame;
  initialProgress?: GameProgress;
  onProgressChange(state: GameProgress): void;
  registerRoundController?: (fn: (round: number) => void) => void;
  nextSlug?: string | null;
}

function clampRound(target: number, totalRounds: number): number {
  if (!Number.isFinite(target)) return 0;
  if (totalRounds <= 0) return 0;
  return Math.max(0, Math.min(totalRounds - 1, Math.floor(target)));
}

export default function CharacterSilhouette({
  mediaId,
  payload,
  initialProgress,
  onProgressChange,
  registerRoundController,
  nextSlug,
}: Props) {
  const roundsData = Array.isArray(payload.rounds) ? payload.rounds : [];

  const {
    rounds,
    activeRoundIndex,
    setActiveRoundIndex,
    totalEntries,
    totalSolved,
    completed,
    progress,
    summaryRoundIndex,
    setSummaryRoundIndex,
    updateEntryValue,
    setEntrySubmitting,
    setEntryFeedback,
    applyGuessResult,
  } = useCharacterSilhouetteGame({ rounds: roundsData, initialProgress });

  const totalRounds = rounds.length > 0 ? rounds.length : 1;
  const activeRoundState = rounds[activeRoundIndex] ?? rounds[0];
  const activeRoundData = roundsData[activeRoundIndex] ?? roundsData[0] ?? null;

  const highestCompletedIndex = useMemo(() => {
    let index = -1;
    rounds.forEach((round, idx) => {
      if (round.completed) {
        index = idx;
      }
    });
    return index;
  }, [rounds]);

  const unlockedThreshold = useMemo(
    () => Math.min(highestCompletedIndex + 1, totalRounds - 1),
    [highestCompletedIndex, totalRounds],
  );

  useEffect(() => {
    onProgressChange(progress);
  }, [progress, onProgressChange]);

  useEffect(() => {
    if (!registerRoundController) return;
    registerRoundController((round) => {
      setActiveRoundIndex(clampRound(round - 1, totalRounds));
    });
  }, [registerRoundController, setActiveRoundIndex, totalRounds]);

  const handleAnimeChange = useCallback(
    (roundIndex: number, entryIndex: number, value: string) => {
      updateEntryValue(roundIndex, entryIndex, "anime", value);
    },
    [updateEntryValue],
  );

  const handleCharacterChange = useCallback(
    (roundIndex: number, entryIndex: number, value: string) => {
      updateEntryValue(roundIndex, entryIndex, "character", value);
    },
    [updateEntryValue],
  );

  const handleValidationError = useCallback(
    (roundIndex: number, entryIndex: number, feedback: FeedbackState) => {
      setEntryFeedback(roundIndex, entryIndex, feedback);
    },
    [setEntryFeedback],
  );

  const handleSubmitGuess = useCallback(
    async (
      roundIndex: number,
      entryIndex: number,
      selection: { value: string; suggestionId?: number },
      characterValue: string,
    ) => {
      const roundState = rounds[roundIndex];
      const roundDataSource = roundsData[roundIndex];
      const entryState = roundState?.entries?.[entryIndex];
      const entryData = roundDataSource?.entries?.[entryIndex];
      if (!roundState || !entryState || !entryData) return;
      if (entryState.completed || entryState.submitting) return;

      const animeGuess = selection.value.trim();
      const characterGuess = characterValue.trim();
      if (!animeGuess || !characterGuess) {
        setEntryFeedback(roundIndex, entryIndex, {
          type: "error",
          message: "Provide both the anime title and character name to continue.",
        });
        return;
      }

      setEntrySubmitting(roundIndex, entryIndex, true);
      setEntryFeedback(roundIndex, entryIndex, null);

      try {
        const result = await verifyGuess(mediaId, animeGuess, selection.suggestionId, {
          characterGuess,
          characterId: entryData.character.id,
        });

        applyGuessResult(roundIndex, entryIndex, {
          anime: animeGuess,
          character: characterGuess,
          animeMatch: result.animeMatch,
          characterMatch:
            typeof result.characterMatch === "boolean"
              ? result.characterMatch
              : result.characterMatch === null
                ? null
                : false,
          resolvedAnime: result.animeMatch
            ? result.match ?? entryData.animeAnswer ?? animeGuess
            : undefined,
          resolvedCharacter:
            result.characterMatch === true
              ? result.characterName ?? entryData.characterAnswer ?? characterGuess
              : undefined,
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to verify your guess. Please try again.";
        setEntryFeedback(roundIndex, entryIndex, {
          type: "error",
          message,
        });
        setEntrySubmitting(roundIndex, entryIndex, false);
      }
    },
    [applyGuessResult, mediaId, rounds, roundsData, setEntryFeedback, setEntrySubmitting],
  );

  const handleRoundSummaryContinue = useCallback(() => {
    if (summaryRoundIndex === null) return;
    const nextIndex = Math.min(summaryRoundIndex + 1, totalRounds - 1);
    setSummaryRoundIndex(null);
    if (summaryRoundIndex < totalRounds - 1) {
      setActiveRoundIndex(nextIndex);
    }
  }, [setActiveRoundIndex, setSummaryRoundIndex, summaryRoundIndex, totalRounds]);

  const roundHeadline = activeRoundState?.label ?? `Round ${activeRoundIndex + 1}`;
  const roundDescription = activeRoundState?.description ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/6 p-5 shadow-[0_12px_40px_rgba(13,14,29,0.35)] backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-3">
          {rounds.map((round, index) => {
            const isActive = index === activeRoundIndex;
            const isCompleted = round.completed;
            const isDisabled = index > unlockedThreshold + 0.0001;
            const label = round.label || `Round ${index + 1}`;
            return (
              <button
                key={round.order ?? index}
                type="button"
                onClick={() => !isDisabled && setActiveRoundIndex(index)}
                disabled={isDisabled}
                className={[
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                  isActive
                    ? "border-brand-300 bg-brand-500/20 text-brand-100 shadow-[0_0_0_1px_rgba(59,130,246,0.35)]"
                    : isCompleted
                      ? "border-emerald-300/60 bg-emerald-500/15 text-emerald-100"
                      : "border-white/15 bg-white/10 text-white/80 hover:border-brand-300/60 hover:text-white",
                  isDisabled ? "cursor-not-allowed opacity-50" : "",
                ].join(" ")}
              >
                <span>{label}</span>
                {isCompleted ? (
                  <span aria-hidden className="text-[0.65rem]">✓</span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="grid gap-4 text-white sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.24em] text-white/60">Characters solved</p>
            <p className="text-2xl font-display font-semibold">
              {totalSolved} / {totalEntries}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.24em] text-white/60">Current stage</p>
            <p className="text-sm text-white/80">
              Round {activeRoundIndex + 1} of {totalRounds}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/4 p-6 shadow-ambient backdrop-blur-xl">
        <div className="mb-6 space-y-2">
          <h3 className="text-xl font-display font-semibold text-white">{roundHeadline}</h3>
          {roundDescription ? (
            <p className="text-sm text-white/75">{roundDescription}</p>
          ) : (
            <p className="text-sm text-white/70">
              Match each silhouette to the correct character and anime to reveal the lineup.
            </p>
          )}
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {activeRoundData?.entries?.map((entry, index) => {
            const state = activeRoundState?.entries?.[index];
            if (!state) return null;
            return (
              <CharacterCard
                key={state.id}
                index={index}
                roundIndex={activeRoundIndex}
                entry={entry}
                state={state}
                onAnimeChange={(value) => handleAnimeChange(activeRoundIndex, index, value)}
                onCharacterChange={(value) => handleCharacterChange(activeRoundIndex, index, value)}
                onSubmit={(selection, characterValue) =>
                  handleSubmitGuess(activeRoundIndex, index, selection, characterValue)
                }
                onValidationError={(feedback) =>
                  handleValidationError(activeRoundIndex, index, feedback)
                }
              />
            );
          })}
        </div>

        {completed ? (
          <div className="mt-8 flex justify-end">
            <NextPuzzleButton nextSlug={nextSlug} />
          </div>
        ) : null}
      </div>

      {summaryRoundIndex !== null ? (
        <RoundSummaryModal
          roundIndex={summaryRoundIndex}
          roundState={rounds[summaryRoundIndex]}
          roundData={roundsData[summaryRoundIndex] ?? null}
          totalRounds={totalRounds}
          totalSolved={totalSolved}
          totalEntries={totalEntries}
          onContinue={handleRoundSummaryContinue}
        />
      ) : null}
    </div>
  );
}

