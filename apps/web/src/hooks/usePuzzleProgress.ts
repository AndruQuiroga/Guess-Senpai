"use client";

import { useCallback, useEffect, useState } from "react";

import { DailyProgress, GameKey, GameProgress } from "../types/progress";

const STORAGE_KEY = "guesssenpai-progress";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

interface StorageShape {
  [date: string]: DailyProgress;
}

interface ProgressResponse {
  date: string;
  progress: DailyProgress;
}

function readStoredProgress(date: string): DailyProgress {
  if (typeof window === "undefined" || !date) return {};
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};
    const parsed: StorageShape = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed[date] ?? {};
  } catch (error) {
    console.warn("Failed to read puzzle progress", error);
    return {};
  }
}

function writeStoredProgress(date: string, value: DailyProgress) {
  if (typeof window === "undefined" || !date) return;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const parsed: StorageShape = stored ? JSON.parse(stored) : {};
    parsed[date] = value;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  } catch (error) {
    console.warn("Failed to persist puzzle progress", error);
  }
}

export function usePuzzleProgress(date: string) {
  const [progress, setProgress] = useState<DailyProgress>(() => readStoredProgress(date));

  useEffect(() => {
    setProgress(readStoredProgress(date));
  }, [date]);

  useEffect(() => {
    if (!date) return;

    let cancelled = false;

    async function hydrateFromServer() {
      try {
        const response = await fetch(`${API_BASE}/puzzles/progress?d=${date}`, {
          credentials: "include",
        });
        if (!response.ok) {
          if (response.status === 401) {
            return;
          }
          throw new Error(`Request failed with status ${response.status}`);
        }
        const payload = (await response.json()) as ProgressResponse;
        if (!payload || typeof payload !== "object") {
          return;
        }
        const serverProgress = payload.progress ?? {};
        if (!cancelled) {
          setProgress(serverProgress);
          writeStoredProgress(date, serverProgress);
        }
      } catch (error) {
        console.warn("Failed to hydrate puzzle progress from server", error);
      }
    }

    void hydrateFromServer();

    return () => {
      cancelled = true;
    };
  }, [date]);

  const persist = useCallback(
    (updater: (previous: DailyProgress) => DailyProgress) => {
      setProgress((prev) => {
        const next = updater(prev ?? {});
        writeStoredProgress(date, next);
        return next;
      });
    },
    [date]
  );

  const pushUpdate = useCallback(
    async (game: GameKey, state: GameProgress) => {
      if (!date) return;
      try {
        const response = await fetch(`${API_BASE}/puzzles/progress`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date,
            progress: {
              [game]: state,
            },
          }),
        });
        if (!response.ok && response.status !== 401) {
          console.warn("Failed to update puzzle progress on server", response.statusText);
        }
      } catch (error) {
        console.warn("Failed to update puzzle progress on server", error);
      }
    },
    [date]
  );

  const recordGame = useCallback(
    (game: GameKey, state: GameProgress) => {
      persist((prev) => ({
        ...prev,
        [game]: state,
      }));
      void pushUpdate(game, state);
    },
    [persist, pushUpdate]
  );

  return { progress, recordGame };
}
