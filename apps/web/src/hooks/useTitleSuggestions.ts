"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export interface TitleSuggestion {
  id: number;
  title: string;
}

export type SuggestionSource = "titles" | "characters";

interface Options {
  /** Which index to search: anime titles (default) or character names. */
  source?: SuggestionSource;
  debounceMs?: number;
  limit?: number;
  minLength?: number;
}

interface TitleSuggestionResponse {
  results?: TitleSuggestion[];
}

/*
 * Session-wide cache of search results, shared by every guess field. Titles
 * rarely change, so repeat queries (backspacing, retyping, other games) never
 * hit the network twice. Oldest entries are evicted past the cap.
 */
const CACHE_LIMIT = 300;
const suggestionCache = new Map<string, TitleSuggestion[]>();

function cacheKey(
  query: string,
  limit: number,
  source: SuggestionSource = "titles",
): string {
  return `${source}:${limit}:${query.toLowerCase().replace(/\s+/g, " ")}`;
}

function rememberSuggestions(key: string, results: TitleSuggestion[]): void {
  suggestionCache.delete(key);
  suggestionCache.set(key, results);
  if (suggestionCache.size > CACHE_LIMIT) {
    const oldest = suggestionCache.keys().next().value;
    if (oldest !== undefined) suggestionCache.delete(oldest);
  }
}

/** Test hook: forget cached suggestions. */
export function clearTitleSuggestionCache(): void {
  suggestionCache.clear();
}

export function useTitleSuggestions(
  query: string,
  {
    source = "titles",
    debounceMs = 300,
    limit = 8,
    minLength = 2,
  }: Options = {},
) {
  const [suggestions, setSuggestions] = useState<TitleSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const normalizedQuery = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    const key = cacheKey(normalizedQuery, limit, source);
    const cached =
      normalizedQuery.length >= minLength
        ? suggestionCache.get(key)
        : undefined;
    if (cached) {
      // Cache hits skip the debounce entirely.
      controllerRef.current?.abort();
      controllerRef.current = null;
      setError(null);
      setLoading(false);
      setSuggestions(cached);
      return;
    }

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

      fetch(`${API_BASE}/puzzles/search-${source}?${searchParams.toString()}`, {
        credentials: "include",
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
          }
          const payload = (await response.json()) as TitleSuggestionResponse;
          const results = Array.isArray(payload.results) ? payload.results : [];
          rememberSuggestions(key, results);
          setSuggestions(results);
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
  }, [debounceMs, limit, minLength, normalizedQuery, source]);

  return {
    suggestions,
    loading,
    error,
  };
}
