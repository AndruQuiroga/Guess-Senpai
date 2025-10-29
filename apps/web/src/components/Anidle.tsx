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
import { evaluateAnidleGuess } from "../utils/evaluateAnidleGuess";
import type {
  AnidleGuessEvaluation,
  AnidleGuessHistoryEntry,
  ListFeedbackItem,
  ListStatus,
  ScalarFeedback,
  ScalarStatus,
} from "../types/anidle";
import { CURRENT_ANIDLE_EVALUATION_VERSION } from "../types/anidle";
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
const HYDRATION_CONCURRENCY = 4;
const HYDRATION_BATCH_SIZE = 4;
const HYDRATION_YIELD_INTERVAL = 8;

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

type ScalarColumnKey = "year" | "averageScore" | "popularity";
type ListColumnKey = "genres" | "tags" | "studios" | "source";

type ScalarColumn = {
  key: ScalarColumnKey;
  label: string;
  type: "scalar";
  options?: { suffix?: string; showSeason?: boolean };
};

type ListColumn = {
  key: ListColumnKey;
  label: string;
  type: "list";
};

type FeedbackColumn = ScalarColumn | ListColumn;

const FEEDBACK_COLUMNS: readonly FeedbackColumn[] = [
  { key: "year", label: "Year", type: "scalar", options: { showSeason: true } },
  {
    key: "averageScore",
    label: "Score",
    type: "scalar",
    options: { suffix: "%" },
  },
  { key: "popularity", label: "Popularity", type: "scalar" },
  { key: "genres", label: "Genres", type: "list" },
  { key: "tags", label: "Tags", type: "list" },
  { key: "studios", label: "Studios", type: "list" },
  { key: "source", label: "Source", type: "list" },
] as const;

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
  const [historyEntries, setHistoryEntries] = useState<AnidleGuessHistoryEntry[]>(
    () => {
      if (initialProgress?.anidleHistory?.length) {
        return initialProgress.anidleHistory.map((entry) => ({ ...entry }));
      }
      const storedGuesses = initialProgress?.guesses ?? [];
      return storedGuesses.map((value) => ({ guess: value }));
    },
  );
  const [completed, setCompleted] = useState(
    initialProgress?.completed ?? false,
  );
  const [hydrating, setHydrating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hydrationProgress, setHydrationProgress] = useState({
    completed: 0,
    total: 0,
  });

  const hydratedGuessesKeyRef = useRef<string | null>(null);
  const previousMediaIdRef = useRef<number | null>(null);
  const guessFieldRef = useRef<TitleGuessFieldHandle | null>(null);
  const evaluationCacheRef = useRef<Map<string, AnidleGuessEvaluation>>(
    new Map(),
  );

  const normalizedAnswer = useMemo(
    () => payload.answer.trim().toLowerCase(),
    [payload.answer],
  );

  useEffect(() => {
    const puzzleChanged = previousMediaIdRef.current !== mediaId;
    const normalizedHistory =
      initialProgress?.anidleHistory?.length
        ? initialProgress.anidleHistory.map((entry) => ({ ...entry }))
        : (initialProgress?.guesses ?? []).map((value) => ({ guess: value }));

    setHistoryEntries(normalizedHistory);

    if (!initialProgress) {
      setRound(1);
      setCompleted(false);
    } else {
      setRound(initialProgress.round ?? 1);
      setCompleted(initialProgress.completed ?? false);
    }

    setGuess("");
    setErrorMessage(null);
    setHydrating(false);
    setHydrationProgress({ completed: 0, total: normalizedHistory.length });
    hydratedGuessesKeyRef.current = null;

    if (puzzleChanged) {
      evaluationCacheRef.current.clear();
    }

    previousMediaIdRef.current = mediaId;
  }, [initialProgress, mediaId]);

  useEffect(() => {
    if (!registerRoundController) return;
    registerRoundController((targetRound) => {
      setRound(() => Math.max(1, Math.min(TOTAL_ROUNDS, targetRound)));
    });
  }, [registerRoundController]);

  const guessValues = useMemo(
    () => historyEntries.map((entry) => entry.guess),
    [historyEntries],
  );

  const incorrectGuessCount = useMemo(
    () => Math.max(0, historyEntries.length - (completed ? 1 : 0)),
    [completed, historyEntries.length],
  );

  const evaluations = useMemo(
    () =>
      historyEntries
        .map((entry) => entry.evaluation)
        .filter(
          (entry): entry is AnidleGuessEvaluation => Boolean(entry),
        ),
    [historyEntries],
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
    const historySnapshot = historyEntries.map((entry) => ({
      guess: entry.guess,
      guessMediaId: entry.guessMediaId ?? null,
      evaluation: entry.evaluation,
      evaluationVersion: entry.evaluationVersion,
      evaluatedAt: entry.evaluatedAt,
    }));

    onProgressChange({
      completed,
      round,
      guesses: guessValues,
      anidleHistory: historySnapshot,
    });
  }, [completed, round, guessValues, historyEntries, onProgressChange]);

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

  const getCacheKey = useCallback(
    (value: string, guessMediaId?: number | null) => {
      return `${mediaId}:${value.trim().toLowerCase()}::${guessMediaId ?? ""}`;
    },
    [mediaId],
  );

  const getHistoryKey = useCallback((entries: AnidleGuessHistoryEntry[]) => {
    return entries
      .map((entry) =>
        `${entry.guess.trim().toLowerCase()}::${entry.guessMediaId ?? ""}::${
          entry.evaluationVersion ?? ""
        }`,
      )
      .join("||");
  }, []);

  const yieldToMainThread = useCallback(async () => {
    await new Promise<void>((resolve) => {
      if (typeof window !== "undefined" && window.requestAnimationFrame) {
        window.requestAnimationFrame(() => resolve());
        return;
      }
      setTimeout(resolve, 16);
    });
  }, []);

  useEffect(() => {
    const entries = historyEntries;
    const hydrationKey = getHistoryKey(entries);

    if (entries.length === 0) {
      hydratedGuessesKeyRef.current = "";
      setHydrating(false);
      setHydrationProgress({ completed: 0, total: 0 });
      return;
    }

    if (hydratedGuessesKeyRef.current === hydrationKey) {
      return;
    }

    let cancelled = false;
    hydratedGuessesKeyRef.current = hydrationKey;

    const pending = entries
      .map((entry, index) => ({ entry, index }))
      .filter(
        ({ entry }) =>
          !entry.evaluation ||
          entry.evaluationVersion !== CURRENT_ANIDLE_EVALUATION_VERSION,
      );

    const total = entries.length;
    const initialCompleted = total - pending.length;

    entries.forEach((entry) => {
      if (
        entry.evaluation &&
        entry.evaluationVersion === CURRENT_ANIDLE_EVALUATION_VERSION
      ) {
        const cacheKey = getCacheKey(entry.guess, entry.guessMediaId ?? null);
        evaluationCacheRef.current.set(cacheKey, entry.evaluation);
      }
    });

    if (pending.length === 0) {
      setHydrating(false);
      setHydrationProgress({ completed: total, total });
      return;
    }

    setHydrating(true);
    setHydrationProgress({ completed: initialCompleted, total });

    const pendingResults = new Map<
      number,
      { evaluation: AnidleGuessEvaluation; evaluatedAt: string }
    >();

    let completedCount = initialCompleted;
    let lastFlushedCount = initialCompleted;
    let cursor = 0;
    const workerCount = Math.min(
      HYDRATION_CONCURRENCY,
      Math.max(pending.length, 1),
    );

    const flush = async (force = false) => {
      if (cancelled) return;
      if (
        !force &&
        completedCount - lastFlushedCount < HYDRATION_BATCH_SIZE
      ) {
        return;
      }

      lastFlushedCount = completedCount;
      setHydrationProgress({ completed: completedCount, total });
      await yieldToMainThread();
    };

    const hydrateEntry = async (
      value: string,
      guessMediaId: number | null,
    ): Promise<AnidleGuessEvaluation> => {
      const guessValue = value.trim();
      if (!guessValue) {
        return createFallbackEvaluation(value);
      }

      const cacheKey = getCacheKey(guessValue, guessMediaId);
      const cached = evaluationCacheRef.current.get(cacheKey);
      if (cached) {
        return cached;
      }

      try {
        const fetched = await evaluateAnidleGuess({
          puzzleMediaId: mediaId,
          guess: guessValue,
          guessMediaId: guessMediaId ?? undefined,
        });
        const resolvedCorrect =
          fetched.correct || guessValue.toLowerCase() === normalizedAnswer;
        const evaluationRecord: AnidleGuessEvaluation = resolvedCorrect
          ? { ...fetched, correct: true }
          : fetched;
        evaluationCacheRef.current.set(cacheKey, evaluationRecord);
        return evaluationRecord;
      } catch (error) {
        if (!cancelled) {
          console.warn("Failed to rebuild Anidle evaluation", error);
        }
        const fallback = createFallbackEvaluation(value);
        evaluationCacheRef.current.set(cacheKey, fallback);
        return fallback;
      }
    };

    async function worker() {
      while (!cancelled) {
        if (cursor >= pending.length) {
          break;
        }
        const pendingIndex = cursor;
        cursor += 1;
        const { entry, index } = pending[pendingIndex];
        const evaluation = await hydrateEntry(
          entry.guess,
          entry.guessMediaId ?? null,
        );
        if (cancelled) {
          break;
        }
        completedCount += 1;
        pendingResults.set(index, {
          evaluation,
          evaluatedAt: new Date().toISOString(),
        });
        if (completedCount % HYDRATION_YIELD_INTERVAL === 0) {
          await yieldToMainThread();
        }
        await flush();
      }
    }

    const workers = Array.from({ length: workerCount }, () => worker());

    async function run() {
      try {
        await Promise.all(workers);
        if (!cancelled) {
          completedCount = total;
          await flush(true);
          if (pendingResults.size > 0) {
            const mergedEntries = entries.map((entry, index) => {
              const update = pendingResults.get(index);
              if (!update) {
                return entry;
              }
              return {
                ...entry,
                evaluation: update.evaluation,
                evaluationVersion: CURRENT_ANIDLE_EVALUATION_VERSION,
                evaluatedAt: update.evaluatedAt,
              };
            });
            setHistoryEntries(mergedEntries);
            hydratedGuessesKeyRef.current = getHistoryKey(mergedEntries);
          } else {
            hydratedGuessesKeyRef.current = hydrationKey;
          }
        }
      } finally {
        if (!cancelled) {
          setHydrating(false);
          setHydrationProgress({ completed: total, total });
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
      setHydrating(false);
    };
  }, [
    createFallbackEvaluation,
    getCacheKey,
    getHistoryKey,
    historyEntries,
    mediaId,
    normalizedAnswer,
    yieldToMainThread,
  ]);

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
        evaluationCacheRef.current.set(
          getCacheKey(value, suggestionId ?? null),
          evaluationRecord,
        );

        setHistoryEntries((prev) => {
          const entry: AnidleGuessHistoryEntry = {
            guess: value,
            guessMediaId: suggestionId ?? null,
            evaluation: evaluationRecord,
            evaluationVersion: CURRENT_ANIDLE_EVALUATION_VERSION,
            evaluatedAt: new Date().toISOString(),
          };
          const next = [...prev, entry];
          hydratedGuessesKeyRef.current = getHistoryKey(next);
          return next;
        });

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
    [
      advanceRound,
      getCacheKey,
      getHistoryKey,
      mediaId,
      normalizedAnswer,
      submitting,
    ],
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

  const renderScalarValue = useCallback(
    (
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
        <div
          className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1 text-sm font-medium ${tone.className}`}
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
      );
    },
    [],
  );

  const renderListValue = useCallback(
    (items: ListFeedbackItem[]) => (
      <div className="flex flex-wrap gap-2">
        {items.length > 0 ? (
          items.map((item) => (
            <span
              key={item.value}
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${LIST_TONES[item.status]}`}
            >
              {item.value}
            </span>
          ))
        ) : (
          <span className="text-xs text-neutral-500">—</span>
        )}
      </div>
    ),
    [],
  );

  const renderFeedbackCell = useCallback(
    (column: FeedbackColumn, entry: AnidleGuessEvaluation) => {
      if (column.type === "scalar") {
        return renderScalarValue(entry[column.key], column.options);
      }
      return renderListValue(entry[column.key]);
    },
    [renderListValue, renderScalarValue],
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
                {evaluations.length > 0 ? (
                  <div className="overflow-x-auto">
                    <div className="min-w-[56rem] rounded-2xl border border-white/10 bg-white/5">
                      <table className="w-full border-collapse text-sm text-white">
                        <thead>
                          <tr className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
                            <th className="px-4 py-3 font-semibold">Guess</th>
                            {FEEDBACK_COLUMNS.map((column) => (
                              <th
                                key={column.key}
                                className="px-4 py-3 font-semibold"
                              >
                                {column.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                          {evaluations.map((entry, index) => {
                            const solved = entry.correct;
                            return (
                              <tr
                                key={`${entry.title}-${index}`}
                                className={`transition ${
                                  solved
                                    ? "bg-emerald-500/10"
                                    : "bg-transparent"
                                }`}
                              >
                                <td className="px-4 py-4 align-top">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-white">
                                        {entry.title}
                                      </p>
                                      <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                                        Guess {index + 1}
                                      </p>
                                    </div>
                                    {solved ? (
                                      <span className="inline-flex items-center rounded-full border border-emerald-400/40 bg-emerald-500/20 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-emerald-50">
                                        Correct
                                      </span>
                                    ) : null}
                                  </div>
                                </td>
                                {FEEDBACK_COLUMNS.map((column) => (
                                  <td
                                    key={column.key}
                                    className="px-4 py-4 align-top"
                                  >
                                    {renderFeedbackCell(column, entry)}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-neutral-300">
                    Previous guesses will appear here.
                  </div>
                )}
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
                    {hydrationProgress.total > 0
                      ? `Replaying your guesses… (${hydrationProgress.completed}/${hydrationProgress.total})`
                      : "Replaying your guesses…"}
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
