"use client";

import { useEffect, useRef } from "react";

import { useAccount } from "../hooks/useAccount";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000;
const MIN_INTERVAL_MS = 60 * 1000;
const FALLBACK_INTERVAL_MS = 10 * 60 * 1000;

type RefreshResponse = {
  refreshed?: boolean;
  expiresAt?: number;
};

export default function SessionRefresher() {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { account, refresh: refreshAccount } = useAccount();

  useEffect(() => {
    let cancelled = false;

    const clearScheduled = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const cleanup = () => {
      cancelled = true;
      clearScheduled();
    };

    const handleUnauthorized = () => {
      clearScheduled();
      if (!cancelled) {
        void refreshAccount();
      }
    };

    const schedule = (delay: number) => {
      if (cancelled) {
        return;
      }
      clearScheduled();
      const clampedDelay = Math.max(delay, MIN_INTERVAL_MS);
      timeoutRef.current = setTimeout(() => {
        void runRefresh();
      }, clampedDelay);
    };

    const runRefresh = async () => {
      if (cancelled || !account.authenticated) {
        return;
      }
      try {
        const response = await fetch(`${API_BASE}/auth/anilist/refresh`, {
          method: "POST",
          credentials: "include",
        });

        if (response.status === 401) {
          handleUnauthorized();
          return;
        }

        if (!response.ok) {
          schedule(FALLBACK_INTERVAL_MS);
          return;
        }

        let data: RefreshResponse | null = null;
        try {
          data = (await response.json()) as RefreshResponse;
        } catch (error) {
          console.warn("Unable to parse refresh response", error);
        }

        const expiresAtSeconds = data?.expiresAt;
        if (!expiresAtSeconds) {
          schedule(FALLBACK_INTERVAL_MS);
          return;
        }

        const expiresInMs = expiresAtSeconds * 1000 - Date.now();
        const nextDelay = expiresInMs - REFRESH_THRESHOLD_MS;
        schedule(nextDelay > 0 ? nextDelay : MIN_INTERVAL_MS);
      } catch (error) {
        console.warn("Token refresh failed", error);
        schedule(FALLBACK_INTERVAL_MS);
      }
    };

    if (!account.authenticated) {
      clearScheduled();
      return cleanup;
    }

    void runRefresh();

    return cleanup;
  }, [account.authenticated, refreshAccount]);

  return null;
}
