"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { GameProgress } from "../hooks/usePuzzleProgress";
import { AnidleGame as AnidlePayload } from "../types/puzzles";
import {
  evaluateAnidleGuess,
  type AnidleGuessEvaluation,
  type ListFeedbackItem,
  type ListStatus,
  type ScalarFeedback,
  type ScalarStatus,
} from "../utils/evaluateAnidleGuess";
import NextPuzzleButton from "./NextPuzzleButton";
import {
  TitleGuessField,
  type TitleGuessFieldHandle,
  type TitleGuessSelection,
} from "./games/TitleGuessField";

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
const MIN_INCORRECT_GUESSES_FOR_HINT = 10;
const INCORRECT_GUESS_INTERVAL = 2;

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
    }
  | {
      type: "synopsis";
      label: string;
      ratio: number;
      text: string;
    };

const SCALAR_TONES: Record<
  ScalarStatus,
  { className: string; icon: string; description: string }
> = {
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
  accountDifficulty: _accountDifficulty,
}: Props) {
  const [round, setRound] = useState(initialProgress?.round ?? 1);
  const [guess, setGuess] = useState("");
  const [guesses, setGuesses] = useState<string[]>(
    initialProgress?.guesses ?? [],
  );
  const [completed, setCompleted] = useState(
    initialProgress?.completed ?? false,
  );
  const [evaluations, setEvaluations] = useState<AnidleGuessEvaluation[]>([]);
  const [hydrating, setHydrating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hydratedGuessesKeyRef = useRef<string | null>(null);
  const previousMediaIdRef = useRef<number | null>(null);
  const guessFieldRef = useRef<TitleGuessFieldHandle | null>(null);

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

  const incorrectGuessCount = useMemo(
    () => Math.max(0, guesses.length - (completed ? 1 : 0)),
    [completed, guesses.length],
  );

  const aggregatedHints = useMemo<AggregatedHint[]>(() => {
    if (incorrectGuessCount < MIN_INCORRECT_GUESSES_FOR_HINT) {
      return [];
    }

    const synopsisEntries = payload.hints.synopsis ?? [];
    if (synopsisEntries.length > 0) {
      const stage = Math.floor(
        (incorrectGuessCount - MIN_INCORRECT_GUESSES_FOR_HINT) /
          INCORRECT_GUESS_INTERVAL,
      );
      const entry =
        synopsisEntries[Math.min(stage, synopsisEntries.length - 1)];
      if (entry && entry.text.trim().length > 0) {
        return [
          {
            type: "synopsis",
            label: "Redacted Synopsis",
            ratio: entry.ratio,
            text: entry.text,
          },
        ];
      }
    }

    const fallbackHints: AggregatedHint[] = [];
    for (const spec of payload.spec) {
      for (const hintKey of spec.hints) {
        switch (hintKey) {
          case "genres":
            if (payload.hints.genres.length > 0) {
              fallbackHints.push({
                type: "text",
                label: "Genres",
                value: payload.hints.genres.slice(0, 3).join(", "),
              });
            }
            break;
          case "tags":
            if (payload.hints.tags.length > 0) {
              fallbackHints.push({
                type: "tags",
                label: "Tag hints",
                values: payload.hints.tags.slice(0, 4),
              });
            }
            break;
          case "year":
            if (payload.hints.year != null) {
              fallbackHints.push({
                type: "text",
                label: "Year",
                value: String(payload.hints.year),
              });
            }
            break;
          case "episodes":
            if (payload.hints.episodes != null) {
              fallbackHints.push({
                type: "text",
                label: "Episodes",
                value: String(payload.hints.episodes),
              });
            }
            break;
          case "duration":
            if (payload.hints.duration) {
              fallbackHints.push({
                type: "text",
                label: "Duration",
                value: `${payload.hints.duration} min`,
              });
            }
            break;
          case "popularity":
            if (payload.hints.popularity) {
              fallbackHints.push({
                type: "text",
                label: "Popularity",
                value: payload.hints.popularity.toLocaleString(),
              });
            }
            break;
          case "average_score":
            if (payload.hints.average_score) {
              fallbackHints.push({
                type: "text",
                label: "Score",
                value: `${payload.hints.average_score}%`,
              });
            }
            break;
          default:
            break;
        }
      }
    }

    return fallbackHints;
  }, [incorrectGuessCount, payload]);

  const synopsisHints = useMemo(
    () =>
      aggregatedHints.filter(
        (hint): hint is Extract<AggregatedHint, { type: "synopsis" }> =>
          hint.type === "synopsis",
      ),
    [aggregatedHints],
  );

  const chipHints = useMemo(
    () =>
      aggregatedHints.filter(
        (hint): hint is Extract<AggregatedHint, { type: "text" | "tags" }> =>
          hint.type === "text" || hint.type === "tags",
      ),
    [aggregatedHints],
  );

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
      popularity: {
        guess: null,
        target: null,
        status: "unknown" as ScalarStatus,
      },
      genres: [],
      tags: [],
      studios: [],
      source: [],
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

  const handleFieldSubmit = useCallback(
    (selection: TitleGuessSelection) => {
      if (completed || submitting) return;
      void submitGuess(selection.value, selection.suggestionId);
    },
    [completed, submitGuess, submitting],
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (completed || submitting) return;
      const selection = guessFieldRef.current?.submit();
      if (!selection) return;
      await submitGuess(selection.value, selection.suggestionId);
    },
    [completed, submitGuess, submitting],
  );

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

  const renderScalar = useCallback(
    (
      label: string,
      value: ScalarFeedback,
      options?: { suffix?: string; showSeason?: boolean },
    ) => {
      const suffix = options?.suffix ?? "";
      const showSeason = options?.showSeason ?? false;
      const tone = SCALAR_TONES[value.status];
      const guessDisplay =
        typeof value.guess === "number" ? `${value.guess}${suffix}` : "—";
      const seasonDisplay =
        showSeason && value.guessSeason
          ? value.guessSeason.toUpperCase()
          : null;
      return (
        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
            {label}
          </span>
          <div
            className={`mt-1 inline-flex items-center gap-2 rounded-xl border px-3 py-1 text-sm font-medium ${tone.className}`}
          >
            <span>{guessDisplay}</span>
            {seasonDisplay ? (
              <span className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-white/70">
                [{seasonDisplay}]
              </span>
            ) : null}
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
      {synopsisHints.length > 0 || chipHints.length > 0 ? (
        <div className="space-y-3">
          {synopsisHints.map((hint) => {
            const percentage = Math.round(hint.ratio * 100);
            return (
              <div
                key={`synopsis-${percentage}`}
                className="rounded-2xl border border-brand-400/30 bg-brand-500/10 px-4 py-3 text-left backdrop-blur"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-200/80">
                    {hint.label}
                  </span>
                  <span className="text-[0.65rem] uppercase tracking-[0.3em] text-brand-200/60">
                    {percentage}% revealed
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-neutral-100/90">
                  {hint.text}
                </p>
              </div>
            );
          })}
          {chipHints.length > 0 ? (
            <div className="flex flex-wrap gap-2 text-xs uppercase tracking-wide text-brand-100/80">
              {chipHints.map((hint) => {
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
          ) : null}
        </div>
      ) : null}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <div className="relative w-full">
          <TitleGuessField
            ref={guessFieldRef}
            className="w-full"
            value={guess}
            onValueChange={setGuess}
            onSubmit={handleFieldSubmit}
            disabled={completed || submitting}
            placeholder={completed ? "You solved Anidle!" : "Type your guess…"}
            ariaLabel="Anidle guess"
            suggestionsLabel="Anidle title suggestions"
          />
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
                          <p className="text-sm font-semibold text-white">
                            {entry.title}
                          </p>
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
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {renderScalar("Year", entry.year, { showSeason: true })}
                        {renderScalar("Score", entry.averageScore, {
                          suffix: "%",
                        })}
                        {renderScalar("Popularity", entry.popularity)}
                        {renderList("Genres", entry.genres)}
                        {renderList("Tags", entry.tags)}
                        {renderList("Studios", entry.studios)}
                        {renderList("Source", entry.source)}
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
