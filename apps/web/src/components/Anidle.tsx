"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";

import { GameProgress } from "../hooks/usePuzzleProgress";
import { useTitleSuggestions } from "../hooks/useTitleSuggestions";
import { AnidleGame as AnidlePayload } from "../types/puzzles";
import { resolveHintRound } from "../utils/difficulty";
import {
  evaluateAnidleGuess,
  type AnidleGuessEvaluation,
  type ListFeedbackItem,
  type ListStatus,
  type ScalarFeedback,
  type ScalarStatus,
} from "../utils/evaluateAnidleGuess";
import NextPuzzleButton from "./NextPuzzleButton";

interface Props {
  mediaId: number;
  payload: AnidlePayload;
  initialProgress?: GameProgress;
  onProgressChange(state: GameProgress): void;
  registerRoundController?: (fn: (round: number) => void) => void;
  nextSlug?: string | null;
  accountDifficulty?: number;
}

const TOTAL_ROUNDS = 3;

type AggregatedHint =
  | {
      type: "text";
      label: string;
      value: string;
    }
  | {
      type: "tags";
      label: string;
      values: string[];
    };

const SCALAR_TONES: Record<ScalarStatus, { className: string; icon: string; description: string }> = {
  match: {
    className: "border-emerald-400/40 bg-emerald-500/10 text-emerald-100",
    icon: "✓",
    description: "Exact match",
  },
  higher: {
    className: "border-rose-400/40 bg-rose-500/10 text-rose-100",
    icon: "↓",
    description: "Guess is higher than the answer",
  },
  lower: {
    className: "border-amber-400/40 bg-amber-500/10 text-amber-100",
    icon: "↑",
    description: "Guess is lower than the answer",
  },
  unknown: {
    className: "border-white/10 bg-white/5 text-neutral-200",
    icon: "?",
    description: "Feedback unavailable",
  },
} as const;

const LIST_TONES: Record<ListStatus, string> = {
  match: "border-emerald-400/40 bg-emerald-500/10 text-emerald-50",
  miss: "border-white/10 bg-white/5 text-neutral-200",
} as const;

export default function Anidle({
  mediaId,
  payload,
  initialProgress,
  onProgressChange,
  registerRoundController,
  nextSlug,
  accountDifficulty,
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
  const [evaluations, setEvaluations] = useState<AnidleGuessEvaluation[]>([]);
  const [hydrating, setHydrating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hydratedGuessesKeyRef = useRef<string | null>(null);
  const previousMediaIdRef = useRef<number | null>(null);

  const blurTimeoutRef = useRef<number | null>(null);
  const listboxId = `${useId()}-anidle-suggestions`;

  const normalizedAnswer = useMemo(
    () => payload.answer.trim().toLowerCase(),
    [payload.answer],
  );

  useEffect(() => {
    const puzzleChanged = previousMediaIdRef.current !== mediaId;
    const noStoredGuesses =
      !initialProgress?.guesses || initialProgress.guesses.length === 0;

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
    if (puzzleChanged || noStoredGuesses) {
      setEvaluations([]);
    }
    setErrorMessage(null);
    setHydrating(false);
    hydratedGuessesKeyRef.current = null;
    previousMediaIdRef.current = mediaId;
  }, [initialProgress, mediaId, payload.answer]);

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

  const hintRound = useMemo(
    () =>
      completed
        ? TOTAL_ROUNDS
        : resolveHintRound(round, TOTAL_ROUNDS, accountDifficulty),
    [accountDifficulty, completed, round],
  );

  const aggregatedHints = useMemo<AggregatedHint[]>(() => {
    const hints: AggregatedHint[] = [];
    const activeSpecs = payload.spec.filter(
      (spec) => spec.difficulty <= hintRound,
    );
    let genresAdded = false;
    let tagsAdded = false;
    for (const spec of activeSpecs) {
      for (const hint of spec.hints) {
        switch (hint) {
          case "genres":
            if (!genresAdded && payload.hints.genres.length > 0) {
              hints.push({
                type: "text",
                label: "Genres",
                value: payload.hints.genres.slice(0, 3).join(", "),
              });
              genresAdded = true;
            }
            break;
          case "tags":
            if (!tagsAdded && payload.hints.tags.length > 0) {
              hints.push({
                type: "tags",
                label: "Tag hints",
                values: payload.hints.tags.slice(0, 4),
              });
              tagsAdded = true;
            }
            break;
          case "year":
            if (payload.hints.year != null)
              hints.push({
                type: "text",
                label: "Year",
                value: String(payload.hints.year),
              });
            break;
          case "episodes":
            if (payload.hints.episodes != null)
              hints.push({
                type: "text",
                label: "Episodes",
                value: String(payload.hints.episodes),
              });
            break;
          case "duration":
            if (payload.hints.duration)
              hints.push({
                type: "text",
                label: "Duration",
                value: `${payload.hints.duration} min`,
              });
            break;
          case "popularity":
            if (payload.hints.popularity)
              hints.push({
                type: "text",
                label: "Popularity",
                value: payload.hints.popularity.toLocaleString(),
              });
            break;
          case "average_score":
            if (payload.hints.average_score)
              hints.push({
                type: "text",
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
  }, [hintRound, payload]);

  useEffect(() => {
    onProgressChange({ completed, round, guesses });
  }, [completed, round, guesses, onProgressChange]);

  const createFallbackEvaluation = useCallback(
    (title: string): AnidleGuessEvaluation => ({
      title,
      correct: false,
      year: { guess: null, target: null, status: "unknown" as ScalarStatus },
      averageScore: {
        guess: null,
        target: null,
        status: "unknown" as ScalarStatus,
      },
      genres: [],
      tags: [],
    }),
    [],
  );

  useEffect(() => {
    const storedGuesses = initialProgress?.guesses ?? [];
    const hydrationKey = storedGuesses.join("||");
    if (storedGuesses.length === 0) {
      hydratedGuessesKeyRef.current = "";
      setEvaluations([]);
      setHydrating(false);
      return;
    }
    if (hydratedGuessesKeyRef.current === hydrationKey) {
      return;
    }

    let cancelled = false;
    hydratedGuessesKeyRef.current = hydrationKey;
    setHydrating(true);

    async function hydrate() {
      try {
        const results = await Promise.all(
          storedGuesses.map(async (value): Promise<AnidleGuessEvaluation> => {
            const guessValue = value.trim();
            if (!guessValue) {
              return createFallbackEvaluation(value);
            }
            try {
              const evaluation = await evaluateAnidleGuess({
                puzzleMediaId: mediaId,
                guess: guessValue,
              });
              if (cancelled) {
                return createFallbackEvaluation(value);
              }
              return evaluation;
            } catch (error) {
              if (!cancelled) {
                console.warn("Failed to rebuild Anidle evaluation", error);
              }
              return createFallbackEvaluation(value);
            }
          }),
        );

        if (!cancelled) {
          setEvaluations(results);
        }
      } finally {
        if (!cancelled) {
          setHydrating(false);
        }
      }
    }

    void hydrate();

    return () => {
      cancelled = true;
      setHydrating(false);
    };
  }, [createFallbackEvaluation, initialProgress, mediaId]);

  const advanceRound = useCallback(() => {
    setRound((prev) => (prev >= TOTAL_ROUNDS ? TOTAL_ROUNDS : prev + 1));
  }, []);

  const submitGuess = useCallback(
    async (rawValue: string, suggestionId?: number) => {
      const value = rawValue.trim();
      if (!value || submitting) return;

      setErrorMessage(null);
      setSubmitting(true);

      const normalizedGuess = value.toLowerCase();

      try {
        const evaluation = await evaluateAnidleGuess({
          puzzleMediaId: mediaId,
          guess: value,
          guessMediaId: suggestionId,
        });
        const resolvedCorrect =
          evaluation.correct || normalizedGuess === normalizedAnswer;
        const evaluationRecord: AnidleGuessEvaluation = resolvedCorrect
          ? { ...evaluation, correct: true }
          : evaluation;

        setGuesses((prev) => {
          const next = [...prev, value];
          hydratedGuessesKeyRef.current = next.join("||");
          return next;
        });
        setEvaluations((prev) => [...prev, evaluationRecord]);

        if (resolvedCorrect) {
          setCompleted(true);
        } else {
          advanceRound();
        }
        setGuess("");
        setIsMenuOpen(false);
        setHighlightedIndex(-1);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to evaluate your guess. Please try again.";
        setErrorMessage(message);
      } finally {
        setSubmitting(false);
      }
    },
    [advanceRound, mediaId, normalizedAnswer, submitting],
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (completed || submitting) return;
      const value = guess.trim();
      if (!value) return;
      const match = suggestions.find(
        (item) => item.title.trim().toLowerCase() === value.toLowerCase(),
      );
      await submitGuess(value, match?.id);
    },
    [completed, guess, submitGuess, submitting, suggestions],
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
      if (completed || submitting) return;
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
        const suggestion = suggestions[highlightedIndex];
        void submitGuess(suggestion.title, suggestion.id);
      } else if (event.key === "Escape") {
        setIsMenuOpen(false);
        setHighlightedIndex(-1);
      }
    },
    [completed, highlightedIndex, submitGuess, submitting, suggestions],
  );

  const trimmedGuess = guess.trim();
  const suggestionsVisible =
    isMenuOpen && !completed && !submitting && trimmedGuess.length >= 2;

  const renderScalar = useCallback(
    (label: string, value: ScalarFeedback, suffix = "") => {
      const tone = SCALAR_TONES[value.status];
      const guessDisplay =
        typeof value.guess === "number"
          ? `${value.guess}${suffix}`
          : "—";
      const targetDisplay =
        typeof value.target === "number" ? `${value.target}${suffix}` : null;
      const display =
        targetDisplay != null
          ? `${guessDisplay} → ${targetDisplay}`
          : guessDisplay;
      return (
        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
            {label}
          </span>
          <div
            className={`mt-1 inline-flex items-center gap-2 rounded-xl border px-3 py-1 text-sm font-medium ${tone.className}`}
          >
            <span>{display}</span>
            <span aria-hidden className="text-xs">
              {tone.icon}
            </span>
            <span className="sr-only">{tone.description}</span>
          </div>
        </div>
      );
    },
    [],
  );

  const renderList = useCallback(
    (label: string, items: ListFeedbackItem[]) => (
      <div>
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
          {label}
        </span>
        <div className="mt-1 flex flex-wrap gap-2">
          {items.length > 0 ? (
            items.map((item) => (
              <span
                key={`${label}-${item.value}`}
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${LIST_TONES[item.status]}`}
              >
                {item.value}
              </span>
            ))
          ) : (
            <span className="text-xs text-neutral-500">—</span>
          )}
        </div>
      </div>
    ),
    [],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 text-xs uppercase tracking-wide text-brand-100/80">
        {aggregatedHints.map((hint) => {
          if (hint.type === "tags") {
            return (
              <div
                key={`${hint.label}-${hint.values.join("|")}`}
                className="flex flex-wrap items-center gap-2 rounded-2xl border border-fuchsia-400/40 bg-fuchsia-500/10 px-3 py-1 font-semibold text-[0.7rem] text-fuchsia-100 backdrop-blur"
              >
                <span className="text-fuchsia-200/80">{hint.label}:</span>
                <div className="flex flex-wrap gap-1 normal-case text-[0.65rem] text-fuchsia-50">
                  {hint.values.map((value) => (
                    <span
                      key={`${hint.label}-${value}`}
                      className="rounded-full border border-fuchsia-300/40 bg-fuchsia-400/20 px-2 py-0.5 font-medium"
                    >
                      {value}
                    </span>
                  ))}
                </div>
              </div>
            );
          }
          return (
            <span
              key={`${hint.label}-${hint.value}`}
              className="rounded-full border border-brand-400/30 bg-brand-500/10 px-3 py-1 font-semibold text-[0.7rem] backdrop-blur"
            >
              <span className="text-brand-200/80">{hint.label}:</span>{" "}
              <span className="text-white/90">{hint.value}</span>
            </span>
          );
        })}
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
            disabled={completed || submitting}
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
                          onMouseDown={(event: MouseEvent<HTMLButtonElement>) => {
                            event.preventDefault();
                            if (submitting) return;
                            void submitGuess(suggestion.title, suggestion.id);
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
          disabled={completed || submitting}
        >
          {submitting ? "Checking…" : "Submit Guess"}
        </button>
      </form>
      <div className="space-y-4" aria-live="polite">
        {errorMessage && (
          <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {errorMessage}
          </div>
        )}
        {(evaluations.length > 0 || hydrating) && (
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
              Guess feedback
            </div>
            <div className="relative min-h-[5rem]">
              <div className="space-y-3">
                {evaluations.map((entry, index) => {
                  const solved = entry.correct;
                  return (
                    <div
                      key={`${entry.title}-${index}`}
                      className={`rounded-2xl border px-4 py-4 transition ${
                        solved
                          ? "border-emerald-400/40 bg-emerald-500/10"
                          : "border-white/10 bg-white/5"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-white">{entry.title}</p>
                          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                            Guess {index + 1}
                          </p>
                        </div>
                        {solved ? (
                          <span className="inline-flex items-center rounded-full border border-emerald-400/40 bg-emerald-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-50">
                            Correct
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {renderScalar("Year", entry.year)}
                        {renderScalar("Score", entry.averageScore, "%")}
                        {renderList("Genres", entry.genres)}
                        {renderList("Tags", entry.tags)}
                      </div>
                    </div>
                  );
                })}
              </div>
              {hydrating && (
                <div
                  className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl bg-neutral-950/70 px-6 py-6 text-center backdrop-blur-sm"
                  role="status"
                  aria-live="polite"
                >
                  <div
                    className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white"
                    aria-hidden
                  />
                  <span className="text-sm font-medium text-white">
                    Replaying your guesses…
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
        {completed && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              Nailed it! The answer was{" "}
              <span className="font-semibold text-emerald-100">
                {payload.answer}
              </span>
              .
            </div>
            <NextPuzzleButton nextSlug={nextSlug} />
          </div>
        )}
      </div>
    </div>
  );
}
