"use client";

import {
  useCallback,
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";

import {
  CURRENT_ANIDLE_EVALUATION_VERSION,
  type AnidleGuessEvaluation,
  type AnidleGuessHistoryEntry,
  type ScalarStatus,
} from "../../types/anidle";
import {
  evaluateAnidleGuess,
  evaluateAnidleGuessBatch,
  type EvaluateAnidleGuessPayload,
} from "../../utils/evaluateAnidleGuess";

const HYDRATION_BATCH_SIZE = 4;
const HYDRATION_YIELD_INTERVAL = 8;

export function createFallbackEvaluation(title: string): AnidleGuessEvaluation {
  const unknown = {
    guess: null,
    target: null,
    status: "unknown" as ScalarStatus,
  };
  return {
    title,
    correct: false,
    year: { ...unknown },
    averageScore: { ...unknown },
    popularity: { ...unknown },
    genres: [],
    tags: [],
    studios: [],
    source: [],
  };
}

export function getHistoryKey(entries: AnidleGuessHistoryEntry[]): string {
  return entries
    .map(
      (entry) =>
        `${entry.guess.trim().toLowerCase()}::${entry.guessMediaId ?? ""}::${
          entry.evaluationVersion ?? ""
        }`,
    )
    .join("||");
}

export function makeCacheKey(
  mediaId: number,
  value: string,
  guessMediaId?: number | null,
): string {
  return `${mediaId}:${value.trim().toLowerCase()}::${guessMediaId ?? ""}`;
}

async function yieldToMainThread() {
  await new Promise<void>((resolve) => {
    if (typeof window !== "undefined" && window.requestAnimationFrame) {
      window.requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 16);
  });
}

interface HydrationOptions {
  mediaId: number;
  historyEntries: AnidleGuessHistoryEntry[];
  setHistoryEntries: Dispatch<SetStateAction<AnidleGuessHistoryEntry[]>>;
  normalizedAnswer: string;
  cacheRef: MutableRefObject<Map<string, AnidleGuessEvaluation>>;
  hydratedKeyRef: MutableRefObject<string | null>;
  setHydrating: Dispatch<SetStateAction<boolean>>;
  setHydrationProgress: Dispatch<
    SetStateAction<{ completed: number; total: number }>
  >;
}

/**
 * Rebuilds evaluations for saved guesses that have none (or an old version),
 * in small batches so a long history never blocks the UI.
 */
export function useAnidleHydration({
  mediaId,
  historyEntries,
  setHistoryEntries,
  normalizedAnswer,
  cacheRef,
  hydratedKeyRef,
  setHydrating,
  setHydrationProgress,
}: HydrationOptions) {
  const getCacheKey = useCallback(
    (value: string, guessMediaId?: number | null) =>
      makeCacheKey(mediaId, value, guessMediaId),
    [mediaId],
  );

  useEffect(() => {
    const entries = historyEntries;
    const hydrationKey = getHistoryKey(entries);

    if (entries.length === 0) {
      hydratedKeyRef.current = "";
      setHydrating(false);
      setHydrationProgress({ completed: 0, total: 0 });
      return;
    }

    if (hydratedKeyRef.current === hydrationKey) return;

    let cancelled = false;
    hydratedKeyRef.current = hydrationKey;

    const pending = entries
      .map((entry, index) => ({ entry, index }))
      .filter(
        ({ entry }) =>
          !entry.evaluation ||
          entry.evaluationVersion !== CURRENT_ANIDLE_EVALUATION_VERSION,
      );

    const total = entries.length;
    const initialCompleted = total - pending.length;

    entries.forEach((entry) => {
      if (
        entry.evaluation &&
        entry.evaluationVersion === CURRENT_ANIDLE_EVALUATION_VERSION
      ) {
        cacheRef.current.set(
          getCacheKey(entry.guess, entry.guessMediaId ?? null),
          entry.evaluation,
        );
      }
    });

    if (pending.length === 0) {
      setHydrating(false);
      setHydrationProgress({ completed: total, total });
      return;
    }

    setHydrating(true);
    setHydrationProgress({ completed: initialCompleted, total });

    const pendingResults = new Map<
      number,
      { evaluation: AnidleGuessEvaluation; evaluatedAt: string }
    >();
    let completedCount = initialCompleted;

    const assignUpdate = (
      index: number,
      evaluation: AnidleGuessEvaluation,
      cacheKey?: string,
    ) => {
      if (cancelled) return;
      if (cacheKey) cacheRef.current.set(cacheKey, evaluation);
      pendingResults.set(index, {
        evaluation,
        evaluatedAt: new Date().toISOString(),
      });
    };

    const finalizeEvaluation = (
      evaluation: AnidleGuessEvaluation,
      guessValue: string,
    ) => {
      if (evaluation.correct || guessValue.toLowerCase() === normalizedAnswer) {
        return evaluation.correct
          ? evaluation
          : { ...evaluation, correct: true };
      }
      return evaluation;
    };

    type PendingItem = { entry: AnidleGuessHistoryEntry; index: number };
    type RequestDescriptor = {
      index: number;
      guessValue: string;
      originalGuess: string;
      cacheKey: string;
      payload: EvaluateAnidleGuessPayload;
    };

    const processChunk = async (chunk: PendingItem[]) => {
      const requests: RequestDescriptor[] = [];

      for (const { entry, index } of chunk) {
        if (cancelled) break;

        const guessMediaId = entry.guessMediaId ?? null;
        const trimmedGuess = entry.guess.trim();
        const cacheKey = getCacheKey(trimmedGuess, guessMediaId);

        if (!trimmedGuess) {
          assignUpdate(index, createFallbackEvaluation(entry.guess), cacheKey);
          continue;
        }

        const cached = cacheRef.current.get(cacheKey);
        if (cached) {
          assignUpdate(index, cached);
          continue;
        }

        requests.push({
          index,
          guessValue: trimmedGuess,
          originalGuess: entry.guess,
          cacheKey,
          payload: {
            puzzleMediaId: mediaId,
            guess: trimmedGuess,
            guessMediaId: guessMediaId ?? undefined,
          },
        });
      }

      if (requests.length === 0 || cancelled) return;

      const applyEvaluation = (
        descriptor: RequestDescriptor,
        evaluation: AnidleGuessEvaluation,
      ) => {
        assignUpdate(
          descriptor.index,
          finalizeEvaluation(evaluation, descriptor.guessValue),
          descriptor.cacheKey,
        );
      };

      try {
        const evaluations = await evaluateAnidleGuessBatch(
          requests.map((item) => item.payload),
        );
        if (cancelled) return;
        evaluations.forEach((evaluation, index) => {
          applyEvaluation(requests[index], evaluation);
        });
      } catch (error) {
        if (!cancelled) {
          console.warn("Failed to batch rebuild Anidle evaluations", error);
        }
        for (const descriptor of requests) {
          if (cancelled) break;
          try {
            const evaluation = await evaluateAnidleGuess(descriptor.payload);
            applyEvaluation(descriptor, evaluation);
          } catch (singleError) {
            if (!cancelled) {
              console.warn("Failed to rebuild Anidle evaluation", singleError);
            }
            assignUpdate(
              descriptor.index,
              createFallbackEvaluation(descriptor.originalGuess),
              descriptor.cacheKey,
            );
          }
        }
      }
    };

    async function hydrate() {
      try {
        for (
          let cursor = 0;
          cursor < pending.length && !cancelled;
          cursor += HYDRATION_BATCH_SIZE
        ) {
          const chunk = pending.slice(cursor, cursor + HYDRATION_BATCH_SIZE);
          await processChunk(chunk);
          if (cancelled) break;
          completedCount += chunk.length;
          setHydrationProgress({ completed: completedCount, total });
          if (completedCount % HYDRATION_YIELD_INTERVAL === 0) {
            await yieldToMainThread();
          }
        }

        if (!cancelled) {
          if (pendingResults.size > 0) {
            const mergedEntries = entries.map((entry, index) => {
              const update = pendingResults.get(index);
              if (!update) return entry;
              return {
                ...entry,
                evaluation: update.evaluation,
                evaluationVersion: CURRENT_ANIDLE_EVALUATION_VERSION,
                evaluatedAt: update.evaluatedAt,
              };
            });
            setHistoryEntries(mergedEntries);
            hydratedKeyRef.current = getHistoryKey(mergedEntries);
          } else {
            hydratedKeyRef.current = hydrationKey;
          }
        }
      } finally {
        if (!cancelled) {
          setHydrating(false);
          setHydrationProgress({ completed: total, total });
        }
      }
    }

    void hydrate();

    return () => {
      cancelled = true;
      setHydrating(false);
    };
  }, [
    cacheRef,
    getCacheKey,
    historyEntries,
    hydratedKeyRef,
    mediaId,
    normalizedAnswer,
    setHistoryEntries,
    setHydrating,
    setHydrationProgress,
  ]);

  return { getCacheKey };
}
