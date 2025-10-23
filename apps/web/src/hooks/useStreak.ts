"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "guesssenpai-streak";

interface StreakState {
  count: number;
  lastDate: string;
}

function readStoredState(): StreakState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StreakState;
    if (!parsed || typeof parsed.count !== "number" || typeof parsed.lastDate !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredState(state: StreakState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* noop */
  }
}

function addDays(date: Date, days: number): Date {
  const clone = new Date(date);
  clone.setDate(clone.getDate() + days);
  return clone;
}

export function useStreak(currentDateIso: string, completed: boolean): number {
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    const stored = readStoredState();
    if (stored) {
      setStreak(stored.count);
    }
  }, []);

  useEffect(() => {
    if (!completed) {
      return;
    }

    const today = new Date(currentDateIso + "T00:00:00Z");
    const stored = readStoredState();

    if (!stored) {
      const nextState = { count: 1, lastDate: currentDateIso };
      writeStoredState(nextState);
      setStreak(nextState.count);
      return;
    }

    if (stored.lastDate === currentDateIso) {
      // Already recorded today.
      setStreak(stored.count);
      return;
    }

    const previousDate = new Date(stored.lastDate + "T00:00:00Z");
    const expected = addDays(previousDate, 1);

    const isConsecutive =
      expected.getUTCFullYear() === today.getUTCFullYear() &&
      expected.getUTCMonth() === today.getUTCMonth() &&
      expected.getUTCDate() === today.getUTCDate();

    const nextCount = isConsecutive ? stored.count + 1 : 1;
    const nextState = { count: nextCount, lastDate: currentDateIso };
    writeStoredState(nextState);
    setStreak(nextState.count);
  }, [completed, currentDateIso]);

  return streak;
}
