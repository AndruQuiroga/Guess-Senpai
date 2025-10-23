"use client";

import { useCallback, useEffect, useState } from "react";

import { DailyProgress, GameKey, GameProgress } from "../types/progress";

const STORAGE_KEY = "guesssenpai-progress";

interface StorageShape {
  [date: string]: DailyProgress;
}

export function usePuzzleProgress(date: string) {
  const [progress, setProgress] = useState<DailyProgress>({});

  useEffect(() => {
    try {
      const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (!stored) return;
      const parsed: StorageShape = JSON.parse(stored);
      if (parsed && typeof parsed === "object" && date in parsed) {
        setProgress(parsed[date] ?? {});
      }
    } catch (error) {
      console.warn("Failed to read puzzle progress", error);
    }
  }, [date]);

  const persist = useCallback(
    (updater: (previous: DailyProgress) => DailyProgress) => {
      setProgress((prev) => {
        const next = updater(prev ?? {});
        try {
          if (typeof window !== "undefined") {
            const stored = window.localStorage.getItem(STORAGE_KEY);
            const parsed: StorageShape = stored ? JSON.parse(stored) : {};
            parsed[date] = next;
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
          }
        } catch (error) {
          console.warn("Failed to persist puzzle progress", error);
        }
        return next;
      });
    },
    [date]
  );

  const recordGame = useCallback(
    (game: GameKey, state: GameProgress) => {
      persist((prev) => ({
        ...prev,
        [game]: state,
      }));
    },
    [persist]
  );

  return { progress, recordGame };
}
