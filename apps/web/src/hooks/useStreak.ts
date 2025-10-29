"use client";

import { useCallback, useEffect, useState } from "react";

import { computeNextStreakSnapshot } from "../utils/streak";
import type { StreakSnapshot } from "../types/streak";
import { useAccount } from "./useAccount";

const STORAGE_KEY = "guesssenpai-streak";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

interface PersistedStreakState {
  count: number;
  lastDate: string | null;
}

interface StreakResponse {
  count: number;
  last_completed: string | null;
}

const DEFAULT_STREAK: StreakSnapshot = {
  count: 0,
  lastCompleted: null,
};

function readStoredState(): PersistedStreakState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedStreakState;
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

function writeStoredState(state: StreakSnapshot) {
  if (typeof window === "undefined") return;
  try {
    const payload: PersistedStreakState = {
      count: state.count,
      lastDate: state.lastCompleted,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* noop */
  }
}

export function useStreak(
  currentDateIso: string,
  completed: boolean,
): StreakSnapshot {
  const { account } = useAccount();
  const isAuthenticated = account.authenticated;
  const [state, setState] = useState<StreakSnapshot>(() => {
    const stored = readStoredState();
    if (!stored) {
      return DEFAULT_STREAK;
    }
    return { count: stored.count, lastCompleted: stored.lastDate };
  });

  useEffect(() => {
    let cancelled = false;

    async function hydrateFromServer() {
      if (!isAuthenticated) {
        return;
      }
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
        const nextState: StreakSnapshot = {
          count: typeof payload.count === "number" ? payload.count : 0,
          lastCompleted: payload.last_completed ?? null,
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
  }, [isAuthenticated]);

  const pushServerUpdate = useCallback(async (next: StreakSnapshot) => {
    if (!isAuthenticated) {
      return;
    }
    if (!next.lastCompleted) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/puzzles/streak`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count: next.count,
          last_completed: next.lastCompleted,
        }),
      });
      if (!response.ok && response.status !== 401) {
        console.warn("Failed to update streak on server", response.statusText);
      }
    } catch (error) {
      console.warn("Failed to update streak on server", error);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!completed) {
      return;
    }
    setState((prev) => {
      const next = computeNextStreakSnapshot(prev, currentDateIso);
      if (next.count === prev.count && next.lastCompleted === prev.lastCompleted) {
        return prev;
      }
      writeStoredState(next);
      void pushServerUpdate(next);
      return next;
    });
  }, [completed, currentDateIso, pushServerUpdate]);

  return state;
}
