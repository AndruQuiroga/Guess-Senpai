"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { GameProgress } from "../hooks/usePuzzleProgress";
import { useTitleSuggestions } from "../hooks/useTitleSuggestions";
import { AnidleGame as AnidlePayload } from "../types/puzzles";

interface Props {
  payload: AnidlePayload;
  initialProgress?: GameProgress;
  onProgressChange(state: GameProgress): void;
  registerRoundController?: (fn: (round: number) => void) => void;
}

const TOTAL_ROUNDS = 3;

export default function Anidle({
  payload,
  initialProgress,
  onProgressChange,
  registerRoundController,
}: Props) {
  const [round, setRound] = useState(initialProgress?.round ?? 1);
  const [guess, setGuess] = useState("");
  const [guesses, setGuesses] = useState<string[]>(
    initialProgress?.guesses ?? [],
  );
  const [completed, setCompleted] = useState(
    initialProgress?.completed ?? false,
  );
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const blurTimeoutRef = useRef<number | null>(null);
  const listboxId = `${useId()}-anidle-suggestions`;

  const normalizedAnswer = useMemo(
    () => payload.answer.trim().toLowerCase(),
    [payload.answer],
  );

  useEffect(() => {
    if (!initialProgress) {
      setRound(1);
      setGuesses([]);
      setCompleted(false);
    } else {
      setRound(initialProgress.round ?? 1);
      setGuesses(initialProgress.guesses ?? []);
      setCompleted(initialProgress.completed ?? false);
    }
    setGuess("");
    setIsMenuOpen(false);
    setHighlightedIndex(-1);
  }, [initialProgress, payload.answer]);

  useEffect(() => {
    if (!registerRoundController) return;
    registerRoundController((targetRound) => {
      setRound(() => Math.max(1, Math.min(TOTAL_ROUNDS, targetRound)));
    });
  }, [registerRoundController]);

  const { suggestions, loading, error } = useTitleSuggestions(
    completed ? "" : guess,
    {
      limit: 8,
    },
  );

  const aggregatedHints = useMemo(() => {
    const hints: { label: string; value: string | number }[] = [];
    const effectiveRound = completed ? TOTAL_ROUNDS : round;
    const activeSpecs = payload.spec.filter(
      (spec) => spec.difficulty <= effectiveRound,
    );
    let genresAdded = false;
    for (const spec of activeSpecs) {
      for (const hint of spec.hints) {
        switch (hint) {
          case "genres":
            if (!genresAdded && payload.hints.genres.length > 0) {
              hints.push({
                label: "Genres",
                value: payload.hints.genres.slice(0, 3).join(", "),
              });
              genresAdded = true;
            }
            break;
          case "year":
            if (payload.hints.year)
              hints.push({ label: "Year", value: payload.hints.year });
            break;
          case "episodes":
            if (payload.hints.episodes)
              hints.push({ label: "Episodes", value: payload.hints.episodes });
            break;
          case "duration":
            if (payload.hints.duration)
              hints.push({
                label: "Duration",
                value: `${payload.hints.duration} min`,
              });
            break;
          case "popularity":
            if (payload.hints.popularity)
              hints.push({
                label: "Popularity",
                value: payload.hints.popularity,
              });
            break;
          case "average_score":
            if (payload.hints.average_score)
              hints.push({
                label: "Score",
                value: `${payload.hints.average_score}%`,
              });
            break;
          default:
            break;
        }
      }
    }
    return hints;
  }, [completed, payload, round]);

  useEffect(() => {
    onProgressChange({ completed, round, guesses });
  }, [completed, round, guesses, onProgressChange]);

  const advanceRound = useCallback(() => {
    setRound((prev) => (prev >= TOTAL_ROUNDS ? TOTAL_ROUNDS : prev + 1));
  }, []);

  const submitGuess = useCallback(
    (rawValue: string) => {
      const value = rawValue.trim();
      if (!value) return;
      const normalizedGuess = value.toLowerCase();
      setGuesses((prev) => [...prev, value]);
      if (normalizedGuess === normalizedAnswer) {
        setCompleted(true);
      } else {
        advanceRound();
      }
      setGuess("");
      setIsMenuOpen(false);
      setHighlightedIndex(-1);
    },
    [advanceRound, normalizedAnswer],
  );

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      submitGuess(guess);
    },
    [guess, submitGuess],
  );

  useEffect(() => {
    if (!isMenuOpen) {
      setHighlightedIndex(-1);
    }
  }, [isMenuOpen]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [suggestions]);

  useEffect(() => {
    if (completed) {
      setIsMenuOpen(false);
    }
  }, [completed]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Backspace") {
        event.preventDefault();
        setGuess("");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        window.clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
    };
  }, []);

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setGuess(event.target.value);
      setIsMenuOpen(true);
    },
    [],
  );

  const handleFocus = useCallback(() => {
    if (blurTimeoutRef.current) {
      window.clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    if (!completed) {
      setIsMenuOpen(true);
    }
  }, [completed]);

  const handleBlur = useCallback(() => {
    if (blurTimeoutRef.current) {
      window.clearTimeout(blurTimeoutRef.current);
    }
    blurTimeoutRef.current = window.setTimeout(() => {
      setIsMenuOpen(false);
      blurTimeoutRef.current = null;
    }, 120);
  }, []);

  const handleInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (completed) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (suggestions.length === 0) {
          setHighlightedIndex(-1);
          return;
        }
        setIsMenuOpen(true);
        setHighlightedIndex((prev) => {
          const next = prev + 1;
          return next >= suggestions.length ? 0 : next;
        });
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        if (suggestions.length === 0) {
          setHighlightedIndex(-1);
          return;
        }
        setIsMenuOpen(true);
        setHighlightedIndex((prev) => {
          const next = prev <= 0 ? suggestions.length - 1 : prev - 1;
          return next;
        });
      } else if (
        event.key === "Enter" &&
        highlightedIndex >= 0 &&
        suggestions[highlightedIndex]
      ) {
        event.preventDefault();
        submitGuess(suggestions[highlightedIndex].title);
      } else if (event.key === "Escape") {
        setIsMenuOpen(false);
        setHighlightedIndex(-1);
      }
    },
    [completed, highlightedIndex, submitGuess, suggestions],
  );

  const trimmedGuess = guess.trim();
  const suggestionsVisible =
    isMenuOpen && !completed && trimmedGuess.length >= 2;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 text-xs uppercase tracking-wide text-brand-100/80">
        {aggregatedHints.map((hint) => (
          <span
            key={`${hint.label}-${hint.value}`}
            className="rounded-full border border-brand-400/30 bg-brand-500/10 px-3 py-1 font-semibold text-[0.7rem] backdrop-blur"
          >
            <span className="text-brand-200/80">{hint.label}:</span>{" "}
            <span className="text-white/90">{hint.value}</span>
          </span>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <div className="relative w-full">
          <input
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-400/20 disabled:cursor-not-allowed disabled:opacity-70"
            placeholder={completed ? "You solved Anidle!" : "Type your guess…"}
            value={guess}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleInputKeyDown}
            disabled={completed}
            aria-label="Anidle guess"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={suggestionsVisible}
            aria-controls={
              suggestionsVisible && suggestions.length > 0
                ? listboxId
                : undefined
            }
            aria-activedescendant={
              highlightedIndex >= 0 && suggestions[highlightedIndex]
                ? `${listboxId}-option-${highlightedIndex}`
                : undefined
            }
          />
          {suggestionsVisible && (
            <div className="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/95 shadow-xl backdrop-blur">
              {loading ? (
                <div className="px-4 py-3 text-sm text-neutral-300">
                  Searching…
                </div>
              ) : error ? (
                <div className="px-4 py-3 text-sm text-rose-300">
                  Couldn't load suggestions
                </div>
              ) : suggestions.length === 0 ? (
                <div className="px-4 py-3 text-sm text-neutral-400">
                  No matches found
                </div>
              ) : (
                <ul
                  role="listbox"
                  id={listboxId}
                  aria-label="Anidle title suggestions"
                  className="max-h-60 overflow-y-auto py-2"
                >
                  {suggestions.map((suggestion, index) => {
                    const isActive = index === highlightedIndex;
                    return (
                      <li
                        key={suggestion.id}
                        id={`${listboxId}-option-${index}`}
                        role="option"
                        aria-selected={isActive}
                      >
                        <button
                          type="button"
                          className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm transition ${
                            isActive
                              ? "bg-brand-500/20 text-white"
                              : "text-neutral-200 hover:bg-white/5"
                          }`}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            submitGuess(suggestion.title);
                          }}
                          onMouseEnter={() => setHighlightedIndex(index)}
                          onFocus={() => setHighlightedIndex(index)}
                        >
                          <span>{suggestion.title}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-brand-500 via-brand-400 to-cyan-400 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-glow transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={completed}
        >
          Submit Guess
        </button>
      </form>
      <div className="space-y-3 text-sm text-neutral-300" aria-live="polite">
        {guesses.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-neutral-500">
            Attempts
            {guesses.map((value, index) => (
              <span
                key={`${value}-${index}`}
                className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[0.7rem] text-neutral-200"
              >
                {value}
              </span>
            ))}
          </div>
        )}
        {completed && (
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            Nailed it! The answer was{" "}
            <span className="font-semibold text-emerald-100">
              {payload.answer}
            </span>
            .
          </div>
        )}
      </div>
    </div>
  );
}
