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
  error: string | null;
  streakError: string | null;
  resolved: boolean;
}

interface AccountResult {
  account: AccountState;
  streak: StreakSnapshot;
  error: string | null;
  streakError: string | null;
}

const defaultAccount: AccountState = { authenticated: false };
const defaultStreak: StreakSnapshot = { count: 0, lastCompleted: null };

let snapshot: AccountSnapshot = {
  account: defaultAccount,
  streak: { ...defaultStreak },
  loading: true,
  error: null,
  streakError: null,
  resolved: false,
};

const listeners = new Set<() => void>();
let inflightRequest: Promise<AccountResult> | null = null;
let initialLoadRequested = false;
let requestVersion = 0;

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

    if (!response.ok && response.status !== 401) {
      throw new Error("Account connection unavailable");
    }
    const data: AccountState =
      response.status === 401
        ? { authenticated: false }
        : await response.json();
    if (typeof data.authenticated !== "boolean")
      throw new Error("Invalid account response");

    let streak: StreakSnapshot = { count: 0, lastCompleted: null };
    let streakError: string | null = null;
    if (data.authenticated) {
      try {
        const streakResponse = await fetch(`${API_BASE}/puzzles/streak`, {
          credentials: "include",
        });
        if (!streakResponse.ok) throw new Error("Streak unavailable");
        if (streakResponse.ok) {
          const streakData = (await streakResponse.json()) as {
            count?: number;
            last_completed?: string | null;
          };
          streak = {
            count: typeof streakData.count === "number" ? streakData.count : 0,
            lastCompleted: streakData.last_completed ?? null,
          };
        }
      } catch {
        streakError = "Streak unavailable";
        if (data.user?.id === snapshot.account.user?.id)
          streak = snapshot.streak;
      }
    }

    return { account: data, streak, error: null, streakError };
  } catch (error) {
    console.warn("Unable to fetch account info", error);
    return {
      account: snapshot.account,
      streak: snapshot.streak,
      error: "Account connection unavailable",
      streakError: "Streak unavailable",
    };
  }
}

async function loadAccountSnapshot(force = false): Promise<AccountResult> {
  if (!force) {
    if (!snapshot.loading) {
      return {
        account: snapshot.account,
        streak: snapshot.streak,
        error: snapshot.error,
        streakError: snapshot.streakError,
      };
    }
    if (inflightRequest) {
      return inflightRequest;
    }
  }

  const version = ++requestVersion;
  setSnapshot({ loading: true });

  const request = requestAccountData().then((result) => {
    if (version === requestVersion)
      setSnapshot({
        account: result.account,
        streak: result.streak,
        loading: false,
        error: result.error,
        streakError: result.streakError,
        resolved: true,
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
  ++requestVersion;
  try {
    const response = await fetch(`${API_BASE}/auth/anilist/logout`, {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) throw new Error("Logout failed");
    inflightRequest = null;
    setSnapshot({
      account: { authenticated: false },
      streak: { ...defaultStreak },
      loading: false,
      error: null,
      streakError: null,
    });
  } catch (error) {
    setSnapshot({ loading: false, error: "Couldn't sign out. Please retry." });
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
    streakCount:
      state.account.authenticated && !state.streakError
        ? state.streak.count
        : null,
    refresh,
    logout,
  };
}

export function useAccountStreak(): {
  streak: StreakSnapshot;
  loading: boolean;
  error: string | null;
} {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return useMemo(
    () => ({
      streak: state.streak,
      loading: state.loading,
      error: state.streakError,
    }),
    [state.streak, state.loading, state.streakError],
  );
}
