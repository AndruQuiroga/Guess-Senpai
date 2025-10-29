"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

import type { StreakSnapshot } from "../types/streak";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export interface AccountState {
  authenticated: boolean;
  user?: {
    id: number;
    username?: string | null;
    avatar?: string | null;
  };
}

interface AccountSnapshot {
  account: AccountState;
  streak: StreakSnapshot;
  loading: boolean;
}

interface AccountResult {
  account: AccountState;
  streak: StreakSnapshot;
}

const defaultAccount: AccountState = { authenticated: false };
const defaultStreak: StreakSnapshot = { count: 0, lastCompleted: null };

let snapshot: AccountSnapshot = {
  account: defaultAccount,
  streak: { ...defaultStreak },
  loading: true,
};

const listeners = new Set<() => void>();
let inflightRequest: Promise<AccountResult> | null = null;
let initialLoadRequested = false;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): AccountSnapshot {
  return snapshot;
}

function emitChange(): void {
  for (const listener of listeners) {
    listener();
  }
}

function setSnapshot(update: Partial<AccountSnapshot>): void {
  snapshot = {
    ...snapshot,
    ...update,
  };
  emitChange();
}

async function requestAccountData(): Promise<AccountResult> {
  try {
    const response = await fetch(`${API_BASE}/auth/anilist/me`, {
      credentials: "include",
    });

    let data: AccountState = { authenticated: false };
    try {
      data = (await response.json()) as AccountState;
    } catch (parseError) {
      // Ignore JSON parsing issues and fall back to the default state.
    }

    let streak: StreakSnapshot = { count: 0, lastCompleted: null };
    if (data.authenticated) {
      try {
        const streakResponse = await fetch(`${API_BASE}/puzzles/streak`, {
          credentials: "include",
        });
        if (streakResponse.ok) {
          const streakData = (await streakResponse.json()) as {
            count?: number;
            last_completed?: string | null;
          };
          streak = {
            count:
              typeof streakData.count === "number" ? streakData.count : 0,
            lastCompleted: streakData.last_completed ?? null,
          };
        }
      } catch (streakError) {
        // If streak fetching fails we simply clear the cached count.
        streak = { count: 0, lastCompleted: null };
      }
    }

    return { account: data, streak };
  } catch (error) {
    console.warn("Unable to fetch account info", error);
    return { account: { authenticated: false }, streak: { ...defaultStreak } };
  }
}

async function loadAccountSnapshot(force = false): Promise<AccountResult> {
  if (!force) {
    if (!snapshot.loading) {
      return {
        account: snapshot.account,
        streak: snapshot.streak,
      };
    }
    if (inflightRequest) {
      return inflightRequest;
    }
  }

  setSnapshot({ loading: true });

  const request = requestAccountData().then((result) => {
    setSnapshot({
      account: result.account,
      streak: result.streak,
      loading: false,
    });
    return result;
  });

  inflightRequest = request;
  void request.finally(() => {
    if (inflightRequest === request) {
      inflightRequest = null;
    }
  });

  return request;
}

async function performLogout(): Promise<void> {
  try {
    await fetch(`${API_BASE}/auth/anilist/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch (error) {
    console.warn("Logout failed", error);
  } finally {
    inflightRequest = null;
    setSnapshot({
      account: { authenticated: false },
      streak: { ...defaultStreak },
      loading: false,
    });
  }
}

export function useAccount() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (!initialLoadRequested) {
      initialLoadRequested = true;
      void loadAccountSnapshot(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    const result = await loadAccountSnapshot(true);
    return result;
  }, []);

  const logout = useCallback(async () => {
    await performLogout();
  }, []);

  return {
    ...state,
    streakCount: state.account.authenticated ? state.streak.count : null,
    refresh,
    logout,
  };
}

export function useAccountStreak(): { streak: StreakSnapshot; loading: boolean } {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return useMemo(
    () => ({ streak: state.streak, loading: state.loading }),
    [state.streak, state.loading],
  );
}
