"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export interface TitleSuggestion {
  id: number;
  title: string;
}

interface Options {
  debounceMs?: number;
  limit?: number;
  minLength?: number;
}

interface TitleSuggestionResponse {
  results?: TitleSuggestion[];
}

export function useTitleSuggestions(
  query: string,
  { debounceMs = 300, limit = 8, minLength = 2 }: Options = {},
) {
  const [suggestions, setSuggestions] = useState<TitleSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const normalizedQuery = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setError(null);

      if (controllerRef.current) {
        controllerRef.current.abort();
        controllerRef.current = null;
      }

      if (normalizedQuery.length < minLength) {
        setSuggestions([]);
        setLoading(false);
        return;
      }

      const controller = new AbortController();
      controllerRef.current = controller;
      setLoading(true);

      const searchParams = new URLSearchParams({
        q: normalizedQuery,
        limit: String(limit),
      });

      fetch(`${API_BASE}/puzzles/search-titles?${searchParams.toString()}`, {
        credentials: "include",
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
          }
          const payload = (await response.json()) as TitleSuggestionResponse;
          setSuggestions(Array.isArray(payload.results) ? payload.results : []);
          setLoading(false);
        })
        .catch((reason) => {
          if (reason.name === "AbortError") return;
          console.warn("Failed to fetch title suggestions", reason);
          setLoading(false);
          setSuggestions([]);
          setError(reason instanceof Error ? reason.message : "Unknown error");
        });
    }, debounceMs);

    return () => {
      window.clearTimeout(handle);
      if (controllerRef.current) {
        controllerRef.current.abort();
        controllerRef.current = null;
      }
    };
  }, [debounceMs, limit, minLength, normalizedQuery]);

  return {
    suggestions,
    loading,
    error,
  };
}
