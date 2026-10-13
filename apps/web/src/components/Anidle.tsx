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
  evaluateAnidleGuessBatch,
  type EvaluateAnidleGuessPayload,
} from "../utils/evaluateAnidleGuess";
import type {
  AnidleGuessEvaluation,
  AnidleGuessHistoryEntry,
  ListFeedbackItem,
  ListStatus,
  ScalarFeedback,
  ScalarStatus,
} from "../types/anidle";
import { CURRENT_ANIDLE_EVALUATION_VERSION } from "../types/anidle";
import { isProgressExhausted } from "../utils/gameAction";
import NextPuzzleButton from "./NextPuzzleButton";
import { Button, Field } from "./ui/Primitives";
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
    className: "border-[#686b6d] bg-[#2c2f31] text-[#f4f0e7]",
    icon: "✓",
    description: "Exact match",
  },
  higher: {
    className: "border-[#686b6d] bg-[#2c2f31] text-[#f4f0e7]",
    icon: "↓",
    description: "Guess is higher than the answer",
  },
  lower: {
    className: "border-[#686b6d] bg-[#2c2f31] text-[#f4f0e7]",
    icon: "↑",
    description: "Guess is lower than the answer",
  },
  unknown: {
    className: "border-[#484b4d] bg-[#2c2f31] text-[#f4f0e7]",
    icon: "?",
    description: "Feedback unavailable",
  },
} as const;

const LIST_TONES: Record<ListStatus, string> = {
  match: "border-[#484b4d] bg-[#2c2f31] text-[#f4f0e7]",
  miss: "border-[#484b4d] bg-[#242628] text-[#f4f0e7]",
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
  const rules = payload.rules?.version === "2" ? payload.rules : null;
  const totalRounds = rules ? 1 : TOTAL_ROUNDS;
  const submissionLock = useRef(false);
  const [round, setRound] = useState(rules ? 1 : (initialProgress?.round ?? 1));
  const [guess, setGuess] = useState("");
  const [historyEntries, setHistoryEntries] = useState<
    AnidleGuessHistoryEntry[]
  >(() => {
    if (initialProgress?.anidleHistory?.length) {
      return initialProgress.anidleHistory.map((entry) => ({ ...entry }));
    }
    const storedGuesses = initialProgress?.guesses ?? [];
    return storedGuesses.map((value) => ({ guess: value }));
  });
  const [completed, setCompleted] = useState(
    initialProgress?.completed ?? false,
  );
  const [hydrating, setHydrating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
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
    const normalizedHistory = initialProgress?.anidleHistory?.length
      ? initialProgress.anidleHistory.map((entry) => ({ ...entry }))
      : (initialProgress?.guesses ?? []).map((value) => ({ guess: value }));

    setHistoryEntries(normalizedHistory);

    if (!initialProgress) {
      setRound(1);
      setCompleted(false);
    } else {
      setRound(rules ? 1 : (initialProgress.round ?? 1));
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
  }, [initialProgress, mediaId, rules]);

  useEffect(() => {
    if (!registerRoundController) return;
    registerRoundController((targetRound) => {
      setRound(() => Math.max(1, Math.min(totalRounds, targetRound)));
    });
  }, [registerRoundController, totalRounds]);

  const guessValues = useMemo(
    () => historyEntries.map((entry) => entry.guess),
    [historyEntries],
  );

  const incorrectGuessCount = useMemo(
    () => Math.max(0, historyEntries.length - (completed ? 1 : 0)),
    [completed, historyEntries.length],
  );
  const exhausted = isProgressExhausted({
    completed,
    attemptLimit: rules?.max_attempts,
    anidleHistory: historyEntries,
  });
  const finished = completed || exhausted;

  const evaluations = useMemo(
    () =>
      historyEntries
        .map((entry) => entry.evaluation)
        .filter((entry): entry is AnidleGuessEvaluation => Boolean(entry)),
    [historyEntries],
  );

  const aggregatedHints = useMemo<AggregatedHint[]>(() => {
    if (rules) {
      const stage = rules.hint_after_incorrect.filter(
        (count) => incorrectGuessCount >= count,
      ).length;
      if (!stage) return [];
      const entries = payload.hints.synopsis.filter((hint) => hint.text.trim());
      if (entries.length) {
        const hint = entries[Math.min(stage - 1, entries.length - 1)];
        return [
          {
            type: "synopsis",
            label: "Synopsis hint",
            ratio: hint.ratio,
            text: hint.text,
          },
        ];
      }
      const hints: AggregatedHint[] = [];
      if (payload.hints.genres.length)
        hints.push({
          type: "text",
          label: "Genres",
          value: payload.hints.genres.join(", "),
        });
      if (stage >= 2 && payload.hints.year != null)
        hints.push({
          type: "text",
          label: "Year",
          value: String(payload.hints.year),
        });
      if (stage >= 3 && payload.hints.tags.length)
        hints.push({
          type: "tags",
          label: "Tag hints",
          values: payload.hints.tags.slice(0, 4),
        });
      return hints;
    }
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
  }, [incorrectGuessCount, payload, rules]);

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
      ...(rules ? { attemptLimit: rules.max_attempts } : {}),
    });
  }, [completed, round, guessValues, historyEntries, onProgressChange, rules]);

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
      .map(
        (entry) =>
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

    const assignUpdate = (
      index: number,
      evaluation: AnidleGuessEvaluation,
      cacheKey?: string,
    ) => {
      if (cancelled) return;
      if (cacheKey) {
        evaluationCacheRef.current.set(cacheKey, evaluation);
      }
      pendingResults.set(index, {
        evaluation,
        evaluatedAt: new Date().toISOString(),
      });
    };

    const finalizeEvaluation = (
      evaluation: AnidleGuessEvaluation,
      guessValue: string,
    ) => {
      if (evaluation.correct || guessValue.toLowerCase() === normalizedAnswer) {
        return evaluation.correct
          ? evaluation
          : { ...evaluation, correct: true };
      }
      return evaluation;
    };

    type PendingItem = {
      entry: AnidleGuessHistoryEntry;
      index: number;
    };

    type RequestDescriptor = {
      index: number;
      guessValue: string;
      originalGuess: string;
      cacheKey: string;
      payload: EvaluateAnidleGuessPayload;
    };

    const processChunk = async (chunk: PendingItem[]) => {
      const requests: RequestDescriptor[] = [];

      for (const { entry, index } of chunk) {
        if (cancelled) break;

        const guessMediaId = entry.guessMediaId ?? null;
        const trimmedGuess = entry.guess.trim();
        const cacheKey = getCacheKey(trimmedGuess, guessMediaId);

        if (!trimmedGuess) {
          const fallback = createFallbackEvaluation(entry.guess);
          assignUpdate(index, fallback, cacheKey);
          continue;
        }

        const cached = evaluationCacheRef.current.get(cacheKey);
        if (cached) {
          assignUpdate(index, cached);
          continue;
        }

        requests.push({
          index,
          guessValue: trimmedGuess,
          originalGuess: entry.guess,
          cacheKey,
          payload: {
            puzzleMediaId: mediaId,
            guess: trimmedGuess,
            guessMediaId: guessMediaId ?? undefined,
          },
        });
      }

      if (requests.length === 0 || cancelled) {
        return;
      }

      const applyEvaluation = (
        descriptor: RequestDescriptor,
        evaluation: AnidleGuessEvaluation,
      ) => {
        const resolved = finalizeEvaluation(evaluation, descriptor.guessValue);
        assignUpdate(descriptor.index, resolved, descriptor.cacheKey);
      };

      try {
        const evaluations = await evaluateAnidleGuessBatch(
          requests.map((item) => item.payload),
        );
        if (cancelled) return;
        evaluations.forEach((evaluation, index) => {
          applyEvaluation(requests[index], evaluation);
        });
      } catch (error) {
        if (!cancelled) {
          console.warn("Failed to batch rebuild Anidle evaluations", error);
        }
        for (const descriptor of requests) {
          if (cancelled) break;
          try {
            const evaluation = await evaluateAnidleGuess(descriptor.payload);
            applyEvaluation(descriptor, evaluation);
          } catch (singleError) {
            if (!cancelled) {
              console.warn("Failed to rebuild Anidle evaluation", singleError);
            }
            const fallback = createFallbackEvaluation(descriptor.originalGuess);
            assignUpdate(descriptor.index, fallback, descriptor.cacheKey);
          }
        }
      }
    };

    async function hydrate() {
      try {
        for (
          let cursor = 0;
          cursor < pending.length && !cancelled;
          cursor += HYDRATION_BATCH_SIZE
        ) {
          const chunk = pending.slice(cursor, cursor + HYDRATION_BATCH_SIZE);
          await processChunk(chunk);
          if (cancelled) {
            break;
          }
          completedCount += chunk.length;
          setHydrationProgress({ completed: completedCount, total });
          if (completedCount % HYDRATION_YIELD_INTERVAL === 0) {
            await yieldToMainThread();
          }
        }

        if (!cancelled) {
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

    void hydrate();

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
    setRound((prev) => (prev >= totalRounds ? totalRounds : prev + 1));
  }, [totalRounds]);

  const submitGuess = useCallback(
    async (rawValue: string, suggestionId?: number) => {
      const value = rawValue.trim();
      if (!value || finished || submissionLock.current) return;
      const normalize = (title: string) =>
        title.trim().replace(/\s+/g, " ").toLowerCase();
      if (
        rules &&
        historyEntries.some(
          (entry) =>
            normalize(entry.guess) === normalize(value) ||
            (suggestionId != null && entry.guessMediaId === suggestionId),
        )
      ) {
        setErrorMessage("You already guessed that title. Try another anime.");
        return;
      }

      setErrorMessage(null);
      setSubmitting(true);
      submissionLock.current = true;

      const normalizedGuess = value.toLowerCase();

      try {
        const evaluation = await evaluateAnidleGuess({
          puzzleMediaId: mediaId,
          guess: value,
          guessMediaId: suggestionId,
        });
        if (
          rules &&
          historyEntries.some(
            (entry) =>
              normalize(entry.evaluation?.title ?? entry.guess) ===
              normalize(evaluation.title),
          )
        ) {
          setErrorMessage("You already guessed that title. Try another anime.");
          return;
        }
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
        submissionLock.current = false;
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
      finished,
      rules,
      historyEntries,
    ],
  );

  const handleFieldSubmit = useCallback(
    (selection: TitleGuessSelection) => {
      if (finished || submitting) return;
      void submitGuess(selection.value, selection.suggestionId);
    },
    [finished, submitGuess, submitting],
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (finished || submitting) return;
      const selection = guessFieldRef.current?.submit();
      if (!selection) return;
      await submitGuess(selection.value, selection.suggestionId);
    },
    [finished, submitGuess, submitting],
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
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1 text-sm font-medium ${tone.className}`}
        >
          <span>{guessDisplay}</span>
          {seasonDisplay ? (
            <span className="text-xs font-semibold text-[#c1c2bd]">
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
              aria-label={`${item.value}: ${item.status === "match" ? "match" : "no match"}`}
              className={`inline-flex items-center gap-1 rounded-md border px-3 py-1 text-sm font-medium ${LIST_TONES[item.status]}`}
            >
              <span aria-hidden>{item.status === "match" ? "✓" : "×"}</span>
              {item.value}
              <span className="text-xs text-[#c1c2bd]">
                {item.status === "match" ? "Match" : "No match"}
              </span>
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
    <div className="space-y-5 text-[#f4f0e7]">
      <details className="rounded-md border border-[#484b4d] bg-[#2c2f31] px-4 py-3 text-sm leading-relaxed text-[#d0d0ca]">
        <summary className="cursor-pointer font-semibold">
          How to play Anidle
        </summary>
        <p className="mt-2">
          {rules ? (
            <>
              Find one exact anime title in {rules.max_attempts} accepted
              guesses. Synopsis hints unlock after{" "}
              {rules.hint_after_incorrect.join(", ")} wrong guesses; when no
              synopsis is available, hints reveal genres, then year, then tags.
              Invalid titles, repeated anime, and failed requests cost no
              attempt. Compare year, score, popularity, genres, tags, studios,
              and source. Arrows point toward the answer; ✓ means a match. The
              final guess can still win.
            </>
          ) : (
            <>
              Guess the anime title. Each accepted title is one attempt; a wrong
              guess advances the round (three rounds total). Compare year,
              format, episodes, score, popularity, genres, and tags with the
              answer. Arrows show higher or lower, and ✓ means a match. The
              first synopsis hint appears after 10 wrong guesses, then another
              every 2.
            </>
          )}
        </p>
      </details>
      {synopsisHints.length > 0 || chipHints.length > 0 ? (
        <div className="space-y-3">
          {synopsisHints.map((hint) => {
            const percentage = Math.round(hint.ratio * 100);
            return (
              <div
                key={`synopsis-${percentage}`}
                className="rounded-md border border-[#686b6d] bg-[#2c2f31] px-4 py-3 text-left"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-[#f4f0e7]">
                    {hint.label}
                  </span>
                  <span className="text-sm text-[#c1c2bd]">
                    {percentage}% revealed
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#f4f0e7]">
                  {hint.text}
                </p>
              </div>
            );
          })}
          {chipHints.length > 0 ? (
            <div className="flex flex-wrap gap-2 text-xs uppercase tracking-wide text-brand-100">
              {chipHints.map((hint) => {
                if (hint.type === "tags") {
                  return (
                    <div
                      key={`${hint.label}-${hint.values.join("|")}`}
                      className="flex flex-wrap items-center gap-2 rounded-md border border-[#686b6d] bg-[#2c2f31] px-3 py-1 font-semibold text-sm text-[#f4f0e7]"
                    >
                      <span className="text-[#c1c2bd]">{hint.label}:</span>
                      <div className="flex flex-wrap gap-1 normal-case text-sm text-[#f4f0e7]">
                        {hint.values.map((value) => (
                          <span
                            key={`${hint.label}-${value}`}
                            className="rounded border border-[#686b6d] bg-[#383a3c] px-2 py-0.5 font-medium"
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
                    className="rounded-md border border-[#686b6d] bg-[#2c2f31] px-3 py-1 text-sm font-semibold"
                  >
                    <span className="text-brand-200">{hint.label}:</span>{" "}
                    <span className="text-[#f4f0e7]">{hint.value}</span>
                  </span>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
      <p className="text-sm text-[#c1c2bd]">
        Attempts:{" "}
        <strong className="text-[#f4f0e7]">{historyEntries.length}</strong>
        {rules ? ` / ${rules.max_attempts}` : ""}
        {completed ? " · Solved" : exhausted ? " · Out of guesses" : ""}
      </p>
      {!finished && (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <Field
            id="anidle-answer"
            label="Anime title"
            className="relative w-full"
          >
            <TitleGuessField
              ref={guessFieldRef}
              id="anidle-answer"
              className="w-full"
              value={guess}
              onValueChange={setGuess}
              onSubmit={handleFieldSubmit}
              disabled={completed || submitting}
              placeholder={
                completed ? "You solved Anidle!" : "Type your guess…"
              }
              ariaLabel="Anidle guess"
              suggestionsLabel="Anidle title suggestions"
            />
          </Field>
          <button
            type="submit"
            className="button button-primary w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            disabled={completed || submitting}
          >
            {submitting ? "Checking…" : "Submit Guess"}
          </button>
        </form>
      )}
      <div className="space-y-4" aria-live="polite">
        {errorMessage && (
          <div className="rounded-lg border border-[#c0566a] bg-[#40242a] px-4 py-3 text-sm text-rose-200">
            {errorMessage}
          </div>
        )}
        {finished && (
          <div className="space-y-3">
            <div
              className="rounded-md border border-[#a44b38] bg-[#382521] px-4 py-4 text-base text-[#f4f0e7]"
              role="status"
              aria-live="polite"
            >
              <span className="block text-sm font-semibold text-[#ff987f]">
                {completed
                  ? `Solved in ${historyEntries.length} ${historyEntries.length === 1 ? "attempt" : "attempts"}`
                  : "Out of guesses · Answer revealed"}
              </span>
              <span className="mt-1 block text-xl font-bold">
                {payload.answer}
              </span>
            </div>
            <NextPuzzleButton
              nextSlug={nextSlug}
              className="button button-primary w-full sm:w-auto"
            />
            <Button
              type="button"
              className="border border-[#686b6d] bg-[#2c2f31] text-[#f4f0e7]"
              onClick={async () => {
                const text = completed
                  ? `I solved today's Anidle puzzle in ${historyEntries.length} ${historyEntries.length === 1 ? "guess" : "guesses"}.`
                  : `Today's Anidle: ${historyEntries.length}/${rules?.max_attempts} guesses, answer revealed. Try the same daily puzzle.`;
                try {
                  if (navigator.share) {
                    await navigator.share({ text });
                  } else {
                    await navigator.clipboard.writeText(text);
                    setShareMessage("Spoiler-free share text copied.");
                  }
                } catch (error) {
                  if (error instanceof Error && error.name !== "AbortError") {
                    setShareMessage(
                      "Share could not be opened. Your result is saved.",
                    );
                  }
                }
              }}
            >
              Share result
            </Button>
            {shareMessage && (
              <p role="status" className="text-sm text-[#c1c2bd]">
                {shareMessage}
              </p>
            )}
          </div>
        )}
        {(evaluations.length > 0 || hydrating) && (
          <div className="space-y-3">
            <div className="text-sm font-semibold text-[#c1c2bd]">
              Guess history · {evaluations.length}{" "}
              {evaluations.length === 1 ? "attempt" : "attempts"}
            </div>
            <div className="relative min-h-[5rem]">
              <div className="space-y-3">
                {evaluations.length > 0 ? (
                  <>
                    <div className="hidden overflow-x-auto lg:block">
                      <div className="min-w-[56rem] rounded-md border border-[#484b4d] bg-[#202223]">
                        <table className="w-full border-collapse text-sm text-white">
                          <thead>
                            <tr className="text-left text-sm font-semibold text-[#c1c2bd]">
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
                                  className={
                                    solved ? "bg-[#302c2a]" : "bg-transparent"
                                  }
                                >
                                  <td className="px-4 py-4 align-top">
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <p className="text-sm font-semibold text-white">
                                          {entry.title}
                                        </p>
                                        <p className="text-sm text-[#c1c2bd]">
                                          Attempt {index + 1}
                                        </p>
                                      </div>
                                      {solved ? (
                                        <span className="inline-flex items-center rounded-md border border-[#686b6d] bg-[#2c2f31] px-3 py-1 text-sm font-semibold text-[#f4f0e7]">
                                          ✓ Correct
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
                    <div className="space-y-2 lg:hidden">
                      {evaluations.map((entry, index) => (
                        <details
                          key={`${entry.title}-mobile-${index}`}
                          className="rounded-md border border-[#484b4d] bg-[#202223]"
                        >
                          <summary className="min-h-11 cursor-pointer px-3 py-3 font-semibold">
                            {entry.correct ? "✓ " : "Guess "}
                            {entry.title}
                            <span className="ml-2 text-sm font-normal text-[#c1c2bd]">
                              Attempt {index + 1} · details
                            </span>
                          </summary>
                          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-[#484b4d] p-3 text-sm">
                            {FEEDBACK_COLUMNS.map((column) => (
                              <div key={column.key}>
                                <dt className="font-semibold text-[#c1c2bd]">
                                  {column.label}
                                </dt>
                                <dd>{renderFeedbackCell(column, entry)}</dd>
                              </div>
                            ))}
                          </dl>
                        </details>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="rounded-md border border-[#484b4d] bg-[#242628] px-4 py-6 text-sm text-[#c1c2bd]">
                    Previous guesses will appear here.
                  </div>
                )}
              </div>
              {hydrating && (
                <div
                  className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-md bg-[#202223] px-6 py-6 text-center"
                  role="status"
                  aria-live="polite"
                >
                  <div
                    className="h-6 w-6 animate-spin rounded-full border-2 border-[#686b6d] border-t-white"
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
      </div>
    </div>
  );
}
