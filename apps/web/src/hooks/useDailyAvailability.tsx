"use client";

import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  buildRuntimeGamesDirectory,
  type GameDirectoryEntry,
} from "../config/games";
import type { DailyPuzzleResponse } from "../types/puzzles";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

declare global {
  interface Window {
    plausible?: (eventName: string, options?: Record<string, unknown>) => void;
  }
}

function logDailyAvailabilityError() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent("daily-availability-error"));
  window.plausible?.("daily-availability-error");
}

interface DailyAvailabilityState {
  guessTheOpeningEnabled: boolean;
  loading: boolean;
  error: boolean;
}

interface DailyAvailabilityContextValue extends DailyAvailabilityState {
  refresh: () => Promise<void>;
}

const DailyAvailabilityContext = createContext<DailyAvailabilityContextValue | null>(null);

function extractGuessOpeningEnabled(payload: DailyPuzzleResponse | null): boolean {
  return Boolean(payload?.guess_the_opening_enabled);
}

export function DailyAvailabilityProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DailyAvailabilityState>({
    guessTheOpeningEnabled: false,
    loading: true,
    error: false,
  });
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchAvailability = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: false }));

    try {
      const response = await fetch(`${API_BASE}/puzzles/today`, {
        credentials: "include",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      let payload: DailyPuzzleResponse | null = null;
      try {
        payload = (await response.json()) as DailyPuzzleResponse;
      } catch (error) {
        console.warn("Failed to parse daily availability payload", error);
      }

      if (!mountedRef.current) {
        return;
      }

      setState({
        guessTheOpeningEnabled: extractGuessOpeningEnabled(payload),
        loading: false,
        error: false,
      });
    } catch (error) {
      console.warn("Failed to load daily availability", error);
      logDailyAvailabilityError();
      if (!mountedRef.current) {
        return;
      }
      setState((prev) => ({
        ...prev,
        loading: false,
        error: true,
      }));
    }
  }, []);

  useEffect(() => {
    void fetchAvailability();
  }, [fetchAvailability]);

  const value = useMemo<DailyAvailabilityContextValue>(
    () => ({
      ...state,
      refresh: fetchAvailability,
    }),
    [state, fetchAvailability],
  );

  return (
    <DailyAvailabilityContext.Provider value={value}>
      {children}
    </DailyAvailabilityContext.Provider>
  );
}

export function useDailyAvailability(): DailyAvailabilityContextValue {
  const context = useContext(DailyAvailabilityContext);
  if (!context) {
    throw new Error("useDailyAvailability must be used within a DailyAvailabilityProvider");
  }
  return context;
}

export function useRuntimeGamesDirectory(): GameDirectoryEntry[] {
  const { guessTheOpeningEnabled } = useDailyAvailability();
  return useMemo(
    () =>
      buildRuntimeGamesDirectory({
        guessTheOpeningEnabled,
      }),
    [guessTheOpeningEnabled],
  );
}
