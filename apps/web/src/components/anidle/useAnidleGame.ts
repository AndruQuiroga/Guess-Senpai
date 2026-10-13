"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import type { GameProgress } from "../../hooks/usePuzzleProgress";
import {
  CURRENT_ANIDLE_EVALUATION_VERSION,
  type AnidleGuessEvaluation,
  type AnidleGuessHistoryEntry,
} from "../../types/anidle";
import type { AnidleGame } from "../../types/puzzles";
import { evaluateAnidleGuess } from "../../utils/evaluateAnidleGuess";
import { isProgressExhausted } from "../../utils/gameAction";
import type {
  TitleGuessFieldHandle,
  TitleGuessSelection,
} from "../games/TitleGuessField";
import {
  LEGACY_TOTAL_ROUNDS,
  availableHintCount,
  computeAnidleHints,
  missesUntilNextHint,
  type AggregatedHint,
} from "./hints";
import { getHistoryKey, useAnidleHydration } from "./useAnidleHydration";

export interface UseAnidleGameOptions {
  mediaId: number;
  payload: AnidleGame;
  initialProgress?: GameProgress;
  onProgressChange(state: GameProgress): void;
  registerRoundController?: (fn: (round: number) => void) => void;
}

function normalizeTitle(title: string) {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

function historyFromProgress(
  progress?: GameProgress,
): AnidleGuessHistoryEntry[] {
  if (progress?.anidleHistory?.length) {
    return progress.anidleHistory.map((entry) => ({ ...entry }));
  }
  return (progress?.guesses ?? []).map((value) => ({ guess: value }));
}

/**
 * State, evaluation, hydration, persistence and the submit lock for Anidle.
 * Rules v2 (`payload.rules`) caps accepted guesses; without rules the game
 * keeps the legacy unlimited, three-round behaviour.
 */
export function useAnidleGame({
  mediaId,
  payload,
  initialProgress,
  onProgressChange,
  registerRoundController,
}: UseAnidleGameOptions) {
  const rules = payload.rules?.version === "2" ? payload.rules : null;
  const totalRounds = rules ? 1 : LEGACY_TOTAL_ROUNDS;
  const submissionLock = useRef(false);
  const [round, setRound] = useState(rules ? 1 : (initialProgress?.round ?? 1));
  const [guess, setGuess] = useState("");
  const [historyEntries, setHistoryEntries] = useState<
    AnidleGuessHistoryEntry[]
  >(() => historyFromProgress(initialProgress));
  const [completed, setCompleted] = useState(
    initialProgress?.completed ?? false,
  );
  const [hintsRevealed, setHintsRevealed] = useState(
    initialProgress?.hintsRevealed ?? 0,
  );
  const [hydrating, setHydrating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hydrationProgress, setHydrationProgress] = useState({
    completed: 0,
    total: 0,
  });
  /** Index (oldest first) of the guess added this session, for the reveal. */
  const [lastAddedIndex, setLastAddedIndex] = useState<number | null>(null);

  const hydratedKeyRef = useRef<string | null>(null);
  const previousMediaIdRef = useRef<number | null>(null);
  const guessFieldRef = useRef<TitleGuessFieldHandle | null>(null);
  const evaluationCacheRef = useRef<Map<string, AnidleGuessEvaluation>>(
    new Map(),
  );

  const normalizedAnswer = useMemo(
    () => payload.answer.trim().toLowerCase(),
    [payload.answer],
  );

  useEffect(() => {
    const puzzleChanged = previousMediaIdRef.current !== mediaId;
    const normalizedHistory = historyFromProgress(initialProgress);

    setHistoryEntries(normalizedHistory);
    // Reveals only ever grow within a puzzle, so a stale echo of older
    // progress cannot hide a hint the player already asked for.
    const savedHints = initialProgress?.hintsRevealed ?? 0;
    setHintsRevealed((prev) =>
      puzzleChanged ? savedHints : Math.max(prev, savedHints),
    );

    if (!initialProgress) {
      setRound(1);
      setCompleted(false);
    } else {
      setRound(rules ? 1 : (initialProgress.round ?? 1));
      setCompleted(initialProgress.completed ?? false);
    }

    setGuess("");
    setErrorMessage(null);
    setHydrating(false);
    setHydrationProgress({ completed: 0, total: normalizedHistory.length });
    hydratedKeyRef.current = null;

    if (puzzleChanged) {
      evaluationCacheRef.current.clear();
      setLastAddedIndex(null);
    }

    previousMediaIdRef.current = mediaId;
  }, [initialProgress, mediaId, rules]);

  useEffect(() => {
    if (!registerRoundController) return;
    registerRoundController((targetRound) => {
      setRound(() => Math.max(1, Math.min(totalRounds, targetRound)));
    });
  }, [registerRoundController, totalRounds]);

  const guessValues = useMemo(
    () => historyEntries.map((entry) => entry.guess),
    [historyEntries],
  );

  const incorrectGuessCount = Math.max(
    0,
    historyEntries.length - (completed ? 1 : 0),
  );
  const exhausted = isProgressExhausted({
    completed,
    attemptLimit: rules?.max_attempts,
    anidleHistory: historyEntries,
  });
  const finished = completed || exhausted;

  const evaluations = useMemo(
    () => historyEntries.map((entry) => entry.evaluation ?? null),
    [historyEntries],
  );

  const hintsAvailable = rules
    ? availableHintCount(rules, incorrectGuessCount)
    : 0;
  const hintsUsed = Math.min(hintsRevealed, hintsAvailable);
  const hintsTotal = rules?.hint_after_incorrect.length ?? 0;
  const nextHintIn = rules
    ? missesUntilNextHint(rules, incorrectGuessCount)
    : null;

  const hints = useMemo<AggregatedHint[]>(
    () => computeAnidleHints(payload, rules, incorrectGuessCount, hintsUsed),
    [hintsUsed, incorrectGuessCount, payload, rules],
  );

  const revealHint = useCallback(() => {
    if (!rules || finished) return;
    setHintsRevealed((prev) => Math.min(prev + 1, hintsAvailable));
  }, [finished, hintsAvailable, rules]);

  useEffect(() => {
    const historySnapshot = historyEntries.map((entry) => ({
      guess: entry.guess,
      guessMediaId: entry.guessMediaId ?? null,
      evaluation: entry.evaluation,
      evaluationVersion: entry.evaluationVersion,
      evaluatedAt: entry.evaluatedAt,
    }));

    onProgressChange({
      completed,
      round,
      guesses: guessValues,
      anidleHistory: historySnapshot,
      ...(rules ? { attemptLimit: rules.max_attempts } : {}),
      ...(hintsRevealed > 0 ? { hintsRevealed } : {}),
    });
  }, [
    completed,
    round,
    guessValues,
    hintsRevealed,
    historyEntries,
    onProgressChange,
    rules,
  ]);

  const { getCacheKey } = useAnidleHydration({
    mediaId,
    historyEntries,
    setHistoryEntries,
    normalizedAnswer,
    cacheRef: evaluationCacheRef,
    hydratedKeyRef,
    setHydrating,
    setHydrationProgress,
  });

  const advanceRound = useCallback(() => {
    setRound((prev) => (prev >= totalRounds ? totalRounds : prev + 1));
  }, [totalRounds]);

  const submitGuess = useCallback(
    async (rawValue: string, suggestionId?: number) => {
      const value = rawValue.trim();
      if (!value || finished || submissionLock.current) return;
      if (
        rules &&
        historyEntries.some(
          (entry) =>
            normalizeTitle(entry.guess) === normalizeTitle(value) ||
            (suggestionId != null && entry.guessMediaId === suggestionId),
        )
      ) {
        setErrorMessage("You already guessed that title. Try another anime.");
        return;
      }

      setErrorMessage(null);
      setSubmitting(true);
      submissionLock.current = true;

      const normalizedGuess = value.toLowerCase();

      try {
        const evaluation = await evaluateAnidleGuess({
          puzzleMediaId: mediaId,
          guess: value,
          guessMediaId: suggestionId,
        });
        if (
          rules &&
          historyEntries.some(
            (entry) =>
              normalizeTitle(entry.evaluation?.title ?? entry.guess) ===
              normalizeTitle(evaluation.title),
          )
        ) {
          setErrorMessage("You already guessed that title. Try another anime.");
          return;
        }
        const resolvedCorrect =
          evaluation.correct || normalizedGuess === normalizedAnswer;
        if (rules && evaluation.matched === false && !resolvedCorrect) {
          setErrorMessage(
            "We couldn't find that anime. Pick a title from the suggestions.",
          );
          return;
        }
        const evaluationRecord: AnidleGuessEvaluation = resolvedCorrect
          ? { ...evaluation, correct: true }
          : evaluation;
        evaluationCacheRef.current.set(
          getCacheKey(value, suggestionId ?? null),
          evaluationRecord,
        );

        setHistoryEntries((prev) => {
          const entry: AnidleGuessHistoryEntry = {
            guess: value,
            guessMediaId: suggestionId ?? null,
            evaluation: evaluationRecord,
            evaluationVersion: CURRENT_ANIDLE_EVALUATION_VERSION,
            evaluatedAt: new Date().toISOString(),
          };
          const next = [...prev, entry];
          hydratedKeyRef.current = getHistoryKey(next);
          return next;
        });
        setLastAddedIndex(historyEntries.length);

        if (resolvedCorrect) {
          setCompleted(true);
        } else {
          advanceRound();
        }
        setGuess("");
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to evaluate your guess. Please try again.",
        );
      } finally {
        submissionLock.current = false;
        setSubmitting(false);
      }
    },
    [
      advanceRound,
      finished,
      getCacheKey,
      historyEntries,
      mediaId,
      normalizedAnswer,
      rules,
    ],
  );

  const handleFieldSubmit = useCallback(
    (selection: TitleGuessSelection) => {
      if (finished || submitting) return;
      void submitGuess(selection.value, selection.suggestionId);
    },
    [finished, submitGuess, submitting],
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (finished || submitting) return;
      const selection = guessFieldRef.current?.submit();
      if (!selection) return;
      await submitGuess(selection.value, selection.suggestionId);
    },
    [finished, submitGuess, submitting],
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Backspace") {
        event.preventDefault();
        setGuess("");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return {
    rules,
    maxAttempts: rules?.max_attempts ?? null,
    guess,
    setGuess,
    guessFieldRef,
    historyEntries,
    evaluations,
    attemptsUsed: historyEntries.length,
    completed,
    exhausted,
    finished,
    hints,
    /** Rules v2: hints earned but not yet revealed. */
    hintsPending: Math.max(0, hintsAvailable - hintsUsed),
    hintsUsed,
    hintsTotal,
    nextHintIn,
    revealHint,
    hydrating,
    hydrationProgress,
    submitting,
    errorMessage,
    lastAddedIndex,
    handleSubmit,
    handleFieldSubmit,
  };
}

export type AnidleGameState = ReturnType<typeof useAnidleGame>;
