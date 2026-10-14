"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { GameProgress, GameRoundProgress } from "../../types/progress";
import { parseOutcome, type RoundOutcome } from "./scoring";

export interface RoundRecord {
  submitted: boolean;
  hints: number;
  guesses: string[];
  answers: Record<string, unknown>;
  outcome: RoundOutcome | null;
}

const EMPTY_RECORD: RoundRecord = {
  submitted: false,
  hints: 0,
  guesses: [],
  answers: {},
  outcome: null,
};

function recordsFromProgress(
  roundCount: number,
  progress?: GameProgress,
): RoundRecord[] {
  const stored = new Map<number, GameRoundProgress>();
  for (const entry of progress?.rounds ?? []) {
    if (entry && Number.isFinite(entry.round)) stored.set(entry.round, entry);
  }
  return Array.from({ length: roundCount }, (_, index) => {
    const entry = stored.get(index + 1);
    if (!entry) return { ...EMPTY_RECORD };
    const outcome = parseOutcome(entry.result);
    return {
      // Only rounds-v3 records carry an outcome; older rounds replay fresh.
      submitted: Boolean(entry.completed && outcome),
      hints: entry.hints ?? 0,
      guesses: [...(entry.guesses ?? [])],
      answers: { ...(entry.answers ?? {}) },
      outcome,
    };
  });
}

function toProgress(
  records: RoundRecord[],
  roundMaxPoints?: number[],
): GameProgress {
  const played = records.filter((record) => record.submitted).length;
  return {
    ...(roundMaxPoints
      ? {
          maxPoints: records.reduce(
            (sum, record, index) =>
              sum + (record.outcome?.max ?? roundMaxPoints[index] ?? 1000),
            0,
          ),
        }
      : {}),
    completed: records.length > 0 && played === records.length,
    // Only grows, so the server's progress ranking keeps the newest record.
    round: Math.min(records.length, played + 1),
    guesses: records.flatMap((record) => record.guesses),
    rounds: records.map((record, index) => ({
      round: index + 1,
      guesses: [...record.guesses],
      completed: record.submitted,
      hints: record.hints,
      answers: record.answers,
      ...(record.submitted
        ? {
            result: record.outcome as unknown as Record<string, unknown>,
            points: record.outcome?.points ?? 0,
          }
        : {}),
    })),
  };
}

export interface UseRoundGameOptions {
  roundMaxPoints?: number[];
  roundCount: number;
  initialProgress?: GameProgress;
  onProgressChange(state: GameProgress): void;
  /** Changes when the puzzle itself changes, resetting local state. */
  puzzleKey: string;
}

/**
 * Shared state for the Easy/Medium/Hard round games. `view` is the round on
 * screen (0-based) or `roundCount` for the end-of-game summary. A round is
 * "play" until its single submission, then "result".
 */
export function useRoundGame({
  roundCount,
  initialProgress,
  onProgressChange,
  puzzleKey,
  roundMaxPoints,
}: UseRoundGameOptions) {
  const [records, setRecords] = useState<RoundRecord[]>(() =>
    recordsFromProgress(roundCount, initialProgress),
  );
  const firstOpen = (list: RoundRecord[]) => {
    const index = list.findIndex((record) => !record.submitted);
    return index === -1 ? roundCount : index;
  };
  const [view, setView] = useState(() => firstOpen(records));
  const recordsRef = useRef(records);
  recordsRef.current = records;

  // Played before rounds v3 shipped: finished, but with nothing to show.
  const legacyFinished =
    Boolean(initialProgress?.completed) &&
    !records.some((record) => record.submitted);

  const loadedKey = useRef(puzzleKey);
  useEffect(() => {
    const incoming = recordsFromProgress(roundCount, initialProgress);
    if (loadedKey.current !== puzzleKey) {
      loadedKey.current = puzzleKey;
      recordsRef.current = incoming;
      setRecords(incoming);
      setView(firstOpen(incoming));
      return;
    }
    // Saved progress often arrives after mount (storage or the server).
    // Merge it in: a played round or a spent hint is never undone locally.
    const current = recordsRef.current;
    let changed = false;
    const merged = current.map((record, index) => {
      const next = incoming[index];
      if (!next || record.submitted) return record;
      if (next.submitted || next.hints > record.hints) {
        changed = true;
        return next;
      }
      return record;
    });
    if (!changed) return;
    recordsRef.current = merged;
    setRecords(merged);
    setView((view) =>
      view < roundCount && merged[view]?.submitted && !current[view]?.submitted
        ? firstOpen(merged)
        : view,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProgress, puzzleKey]);

  const commit = useCallback(
    (next: RoundRecord[]) => {
      recordsRef.current = next;
      setRecords(next);
      onProgressChange(toProgress(next, roundMaxPoints));
    },
    [onProgressChange, roundMaxPoints],
  );

  /** Spends a hint; `answers` records which one (e.g. a card or clue name). */
  const takeHint = useCallback(
    (roundIndex: number, answers?: Record<string, unknown>) => {
      const current = recordsRef.current;
      const record = current[roundIndex];
      if (!record || record.submitted) return;
      commit(
        current.map((entry, index) =>
          index === roundIndex
            ? {
                ...entry,
                hints: entry.hints + 1,
                answers: { ...entry.answers, ...answers },
              }
            : entry,
        ),
      );
    },
    [commit],
  );

  const submitRound = useCallback(
    (
      roundIndex: number,
      submission: {
        answers: Record<string, unknown>;
        guesses: string[];
        outcome: RoundOutcome;
      },
    ) => {
      const current = recordsRef.current;
      if (!current[roundIndex] || current[roundIndex].submitted) return;
      commit(
        current.map((entry, index) =>
          index === roundIndex
            ? {
                ...entry,
                submitted: true,
                answers: submission.answers,
                guesses: submission.guesses,
                outcome: submission.outcome,
              }
            : entry,
        ),
      );
    },
    [commit],
  );

  const totalPoints = useMemo(
    () =>
      records.reduce((sum, record) => sum + (record.outcome?.points ?? 0), 0),
    [records],
  );
  const playedCount = records.filter((record) => record.submitted).length;

  /** Rounds that may be opened: every played round, plus the next one. */
  const canView = useCallback(
    (index: number) =>
      index === roundCount
        ? playedCount === roundCount
        : index <= Math.min(playedCount, roundCount - 1),
    [playedCount, roundCount],
  );

  const goTo = useCallback(
    (index: number) => {
      if (canView(index)) setView(index);
    },
    [canView],
  );

  /** From a results screen: the next unplayed round, or the summary. */
  const advance = useCallback(() => {
    setView(firstOpen(recordsRef.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    records,
    view,
    goTo,
    canView,
    advance,
    takeHint,
    submitRound,
    totalPoints,
    playedCount,
    finished: playedCount === roundCount,
    legacyFinished,
  };
}

export type RoundGameState = ReturnType<typeof useRoundGame>;
