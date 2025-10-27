"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "guesssenpai-streak";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

interface StreakState {
  count: number;
  lastDate: string | null;
}

export interface StreakSnapshot {
  count: number;
  lastCompleted: string | null;
}

interface StreakResponse {
  count: number;
  last_completed: string | null;
}

function readStoredState(): StreakState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StreakState;
    if (!parsed || typeof parsed.count !== "number") {
      return null;
    }
    if (parsed.lastDate !== null && typeof parsed.lastDate !== "string") {
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

function computeNextState(previous: StreakState, currentDateIso: string): StreakState {
  if (!currentDateIso) {
    return previous;
  }
  if (previous.lastDate === currentDateIso) {
    return previous;
  }

  const today = new Date(currentDateIso + "T00:00:00Z");

  if (!previous.lastDate) {
    return { count: 1, lastDate: currentDateIso };
  }

  const previousDate = new Date(previous.lastDate + "T00:00:00Z");
  const expected = addDays(previousDate, 1);
  const isConsecutive =
    expected.getUTCFullYear() === today.getUTCFullYear() &&
    expected.getUTCMonth() === today.getUTCMonth() &&
    expected.getUTCDate() === today.getUTCDate();

  const nextCount = isConsecutive ? previous.count + 1 : 1;
  return { count: nextCount, lastDate: currentDateIso };
}

export function useStreak(
  currentDateIso: string,
  completed: boolean,
): StreakSnapshot {
  const [state, setState] = useState<StreakState>(() => readStoredState() ?? { count: 0, lastDate: null });

  useEffect(() => {
    let cancelled = false;

    async function hydrateFromServer() {
      try {
        const response = await fetch(`${API_BASE}/puzzles/streak`, {
          credentials: "include",
        });
        if (!response.ok) {
          if (response.status === 401) {
            return;
          }
          throw new Error(`Request failed with status ${response.status}`);
        }
        const payload = (await response.json()) as StreakResponse;
        if (!payload || typeof payload !== "object") {
          return;
        }
        const nextState: StreakState = {
          count: typeof payload.count === "number" ? payload.count : 0,
          lastDate: payload.last_completed ?? null,
        };
        if (!cancelled) {
          setState(nextState);
          writeStoredState(nextState);
        }
      } catch (error) {
        console.warn("Failed to hydrate streak from server", error);
      }
    }

    void hydrateFromServer();

    return () => {
      cancelled = true;
    };
  }, []);

  const pushServerUpdate = useCallback(async (next: StreakState) => {
    if (!next.lastDate) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/puzzles/streak`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count: next.count,
          last_completed: next.lastDate,
        }),
      });
      if (!response.ok && response.status !== 401) {
        console.warn("Failed to update streak on server", response.statusText);
      }
    } catch (error) {
      console.warn("Failed to update streak on server", error);
    }
  }, []);

  useEffect(() => {
    if (!completed) {
      return;
    }

    setState((prev) => {
      const next = computeNextState(prev, currentDateIso);
      if (next.count === prev.count && next.lastDate === prev.lastDate) {
        return prev;
      }
      writeStoredState(next);
      void pushServerUpdate(next);
      return next;
    });
  }, [completed, currentDateIso, pushServerUpdate]);

  return { count: state.count, lastCompleted: state.lastDate };
}
