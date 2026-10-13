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
  status: "pending" | "ready" | "error";
  daily: {
    date: string;
    puzzle_id: string;
    rules_version: string;
    reset_at: string;
    available_modes: string[];
  } | null;
}

interface DailyAvailabilityContextValue extends DailyAvailabilityState {
  loading: boolean;
  error: boolean;
  refresh: () => Promise<void>;
}

const DailyAvailabilityContext =
  createContext<DailyAvailabilityContextValue | null>(null);

export function DailyAvailabilityProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [state, setState] = useState<DailyAvailabilityState>({
    guessTheOpeningEnabled: false,
    status: "pending",
    daily: null,
  });
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchAvailability = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setState((prev) => ({ ...prev, status: "pending" }));

    try {
      const response = await fetch(`${API_BASE}/puzzles/availability`, {
        credentials: "include",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const payload: unknown = await response.json();
      if (
        !payload ||
        typeof payload !== "object" ||
        typeof (payload as { guess_the_opening_enabled?: unknown })
          .guess_the_opening_enabled !== "boolean"
      ) {
        throw new Error("Malformed daily availability response");
      }

      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      const daily = payload as NonNullable<DailyAvailabilityState["daily"]>;
      if (
        typeof daily.date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(daily.date) ||
        typeof daily.puzzle_id !== "string" ||
        typeof daily.rules_version !== "string" ||
        !Number.isFinite(Date.parse(daily.reset_at)) ||
        !Array.isArray(daily.available_modes)
      ) {
        throw new Error("Malformed daily identity response");
      }

      setState({
        guessTheOpeningEnabled: Boolean(
          (payload as { guess_the_opening_enabled: boolean })
            .guess_the_opening_enabled,
        ),
        status: "ready",
        daily,
      });
    } catch (error) {
      console.warn("Failed to load daily availability", error);
      logDailyAvailabilityError();
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return;
      }
      setState((prev) => ({
        ...prev,
        status: "error",
      }));
    }
  }, []);

  useEffect(() => {
    void fetchAvailability();
  }, [fetchAvailability]);

  const value = useMemo<DailyAvailabilityContextValue>(
    () => ({
      ...state,
      loading: state.status === "pending",
      error: state.status === "error",
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
    throw new Error(
      "useDailyAvailability must be used within a DailyAvailabilityProvider",
    );
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
