"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  GameProgress,
  GameRoundProgress,
} from "../hooks/usePuzzleProgress";
import { PosterZoomGame as PosterPayload } from "../types/puzzles";
import { resolveHintRound } from "../utils/difficulty";
import { formatMediaFormatLabel } from "../utils/formatMediaFormatLabel";
import { verifyGuess } from "../utils/verifyGuess";
import NextPuzzleButton from "./NextPuzzleButton";
import {
  TitleGuessField,
  type TitleGuessFieldHandle,
  type TitleGuessSelection,
} from "./games/TitleGuessField";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

const SEASON_OPTIONS = ["", "Winter", "Spring", "Summer", "Fall"] as const;
type SeasonValue = (typeof SEASON_OPTIONS)[number];

type FeedbackState =
  | { type: "success"; message: string }
  | { type: "partial"; message: string }
  | { type: "error"; message: string }
  | null;

interface RoundState {
  guesses: string[];
  yearGuesses: number[];
  stage: number;
  completed: boolean;
  canonicalTitle: string;
  feedback: FeedbackState;
  hintUsed: boolean;
  resolvedYear?: number;
}

interface RoundDraft {
  guess: string;
  season: SeasonValue;
  year: string;
}

interface Props {
  payload: PosterPayload;
  initialProgress?: GameProgress;
  onProgressChange(state: GameProgress): void;
  registerRoundController?: (fn: (round: number) => void) => void;
  nextSlug?: string | null;
  accountDifficulty?: number;
}

function resolveTotalStages(
  round: PosterPayload["rounds"][number],
  spec: PosterPayload["spec"],
): number {
  const specLength = spec.length;
  const cropLength = round.cropStages?.length ?? 0;
  if (specLength > 0 || cropLength > 0) {
    const maxLength = Math.max(
      specLength > 0 ? specLength : 0,
      cropLength > 0 ? cropLength : 0,
    );
    return Math.max(1, maxLength);
  }
  return 3;
}

function parseYearInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

export default function PosterZoom({
  payload,
  initialProgress,
  onProgressChange,
  registerRoundController,
  nextSlug,
  accountDifficulty,
}: Props) {
  const totalRounds = useMemo(
    () => (payload.rounds.length > 0 ? payload.rounds.length : 1),
    [payload.rounds.length],
  );

  const clampRoundIndex = useCallback(
    (target: number) => {
      if (totalRounds <= 0) return 0;
      return Math.max(0, Math.min(totalRounds - 1, target));
    },
    [totalRounds],
  );

  const [activeRoundIndex, setActiveRoundIndex] = useState(() =>
    clampRoundIndex((initialProgress?.round ?? 1) - 1),
  );
  const [roundStates, setRoundStates] = useState<RoundState[]>(() =>
    payload.rounds.map((round) => ({
      guesses: [],
      yearGuesses: [],
      stage: 1,
      completed: false,
      canonicalTitle: round.answer,
      feedback: null,
      hintUsed: false,
      resolvedYear: undefined,
    })),
  );
  const [roundDrafts, setRoundDrafts] = useState<RoundDraft[]>(() =>
    payload.rounds.map(() => ({ guess: "", season: "", year: "" })),
  );
  const [guess, setGuess] = useState("");
  const [seasonSelection, setSeasonSelection] = useState<SeasonValue>("");
  const [seasonYear, setSeasonYear] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const guessFieldRef = useRef<TitleGuessFieldHandle | null>(null);

  const storedRoundMap = useMemo(() => {
    const map = new Map<number, GameRoundProgress>();
    const storedRounds = initialProgress?.rounds ?? [];
    storedRounds.forEach((entry) => {
      if (!entry) return;
      const normalizedRound = Number.isFinite(entry.round)
        ? Math.max(1, Math.floor(entry.round))
        : null;
      if (!normalizedRound) return;
      const storedTitleGuesses = Array.isArray(entry.titleGuesses)
        ? entry.titleGuesses.filter(
            (value): value is string =>
              typeof value === "string" && value.trim().length > 0,
          )
        : null;
      const storedGuesses = storedTitleGuesses?.length
        ? storedTitleGuesses
        : Array.isArray(entry.guesses)
          ? entry.guesses.filter(
              (value): value is string =>
                typeof value === "string" && value.trim().length > 0,
            )
          : [];
      const storedYearGuesses = Array.isArray(entry.yearGuesses)
        ? entry.yearGuesses.filter(
            (value): value is number =>
              typeof value === "number" && Number.isFinite(value),
          )
        : [];
      map.set(normalizedRound, {
        round: normalizedRound,
        guesses: [...storedGuesses],
        titleGuesses: storedTitleGuesses?.length
          ? [...storedTitleGuesses]
          : undefined,
        yearGuesses: storedYearGuesses.length
          ? [...storedYearGuesses]
          : undefined,
        stage: entry.stage,
        completed: entry.completed,
        hintUsed: entry.hintUsed,
        resolvedAnswer: entry.resolvedTitle ?? entry.resolvedAnswer,
        resolvedTitle: entry.resolvedTitle ?? entry.resolvedAnswer,
        resolvedYear: entry.resolvedYear,
      });
    });
    return map;
  }, [initialProgress?.rounds]);

  const updateRoundDraft = useCallback((index: number, patch: Partial<RoundDraft>) => {
    setRoundDrafts((prev) =>
      prev.map((entry, idx) => (idx === index ? { ...entry, ...patch } : entry)),
    );
  }, []);

  useEffect(() => {
    const fallbackIndex = clampRoundIndex((initialProgress?.round ?? 1) - 1);
    const fallbackGuesses =
      initialProgress && Array.isArray(initialProgress.guesses)
        ? initialProgress.guesses.filter(
            (value): value is string =>
              typeof value === "string" && value.trim().length > 0,
          )
        : [];
    const markAllCompleted =
      Boolean(initialProgress?.completed) && storedRoundMap.size === 0;

    const nextStates: RoundState[] = payload.rounds.map((round, index) => {
      const totalStages = resolveTotalStages(round, payload.spec);
      const stored = storedRoundMap.get(index + 1);

      const storedGuesses = stored
        ? Array.isArray(stored.titleGuesses) && stored.titleGuesses.length > 0
          ? stored.titleGuesses
          : Array.isArray(stored.guesses)
            ? stored.guesses
            : []
        : [];
      const guesses = storedGuesses
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter((value) => value.length > 0);

      const storedYears = stored?.yearGuesses ?? [];
      const yearGuesses = Array.isArray(storedYears)
        ? storedYears.filter(
            (value): value is number =>
              typeof value === "number" && Number.isFinite(value),
          )
        : [];

      let completed = false;
      if (stored?.completed !== undefined) {
        completed = Boolean(stored.completed);
      } else if (markAllCompleted) {
        completed = true;
      }

      let stage = 1;
      if (stored?.stage !== undefined && Number.isFinite(stored.stage)) {
        const normalizedStage = Math.floor(stored.stage ?? 1);
        stage = Math.max(1, Math.min(totalStages, normalizedStage));
      } else if (completed) {
        stage = totalStages;
      }

      let hintUsed = false;
      if (stored?.hintUsed !== undefined) {
        hintUsed = Boolean(stored.hintUsed);
      } else if (completed || stage > 1) {
        hintUsed = true;
      }

      const resolvedTitle = stored?.resolvedTitle ?? stored?.resolvedAnswer;
      const canonicalTitle =
        resolvedTitle && resolvedTitle.trim().length > 0
          ? resolvedTitle
          : round.answer;

      let resolvedYear: number | undefined;
      if (stored?.resolvedYear !== undefined && stored.resolvedYear !== null) {
        resolvedYear = stored.resolvedYear;
      } else if (completed) {
        resolvedYear = round.meta.year ?? resolvedYear;
      }

      const fallbackGuessList =
        !stored &&
        initialProgress &&
        storedRoundMap.size === 0 &&
        index === fallbackIndex
          ? [...fallbackGuesses]
          : [];

      const normalizedGuesses =
        guesses.length > 0 ? guesses : fallbackGuessList;

      const feedback: FeedbackState = completed
        ? {
            type: "success",
            message: `Poster solved! ${canonicalTitle}`,
          }
        : null;

      return {
        guesses: normalizedGuesses,
        yearGuesses,
        stage,
        completed,
        canonicalTitle,
        feedback,
        hintUsed,
        resolvedYear,
      };
    });

    const nextDrafts: RoundDraft[] = payload.rounds.map(() => ({
      guess: "",
      season: "",
      year: "",
    }));

    const firstIncomplete = nextStates.findIndex((state) => !state.completed);
    const fallbackUnlocked =
      fallbackIndex >= 0 &&
      fallbackIndex < nextStates.length &&
      (fallbackIndex === 0 ||
        nextStates.slice(0, fallbackIndex).every((state) => state.completed));
    const targetIndex =
      nextStates.length === 0
        ? 0
        : fallbackUnlocked
          ? fallbackIndex
          : firstIncomplete === -1
            ? clampRoundIndex(nextStates.length - 1)
            : firstIncomplete;

    setRoundStates(nextStates);
    setRoundDrafts(nextDrafts);
    setActiveRoundIndex(targetIndex);
    setGuess(nextDrafts[targetIndex]?.guess ?? "");
    setSeasonSelection(nextDrafts[targetIndex]?.season ?? "");
    setSeasonYear(nextDrafts[targetIndex]?.year ?? "");
    guessFieldRef.current?.close();
  }, [
    clampRoundIndex,
    initialProgress,
    payload,
    storedRoundMap,
  ]);

  useEffect(() => {
    if (!registerRoundController) return;
    registerRoundController((targetRound) => {
      setActiveRoundIndex((prev) => {
        const clamped = clampRoundIndex(targetRound - 1);
        if (clamped === prev) {
          return prev;
        }
        const unlocked =
          clamped <= 0 ||
          roundStates.slice(0, clamped).every((state) => state.completed);
        return unlocked ? clamped : prev;
      });
    });
  }, [clampRoundIndex, registerRoundController, roundStates]);

  const currentRound = payload.rounds[activeRoundIndex];
  const currentState = roundStates[activeRoundIndex];
  const currentDraft = roundDrafts[activeRoundIndex];

  useEffect(() => {
    setGuess(currentDraft?.guess ?? "");
    setSeasonSelection(currentDraft?.season ?? "");
    setSeasonYear(currentDraft?.year ?? "");
  }, [currentDraft?.guess, currentDraft?.season, currentDraft?.year]);

  useEffect(() => {
    guessFieldRef.current?.close();
  }, [activeRoundIndex]);

  const handleGuessChange = useCallback(
    (value: string) => {
      setGuess(value);
      updateRoundDraft(activeRoundIndex, { guess: value });
    },
    [activeRoundIndex, updateRoundDraft],
  );

  const handleSeasonChange = useCallback(
    (value: SeasonValue) => {
      setSeasonSelection(value);
      updateRoundDraft(activeRoundIndex, { season: value });
    },
    [activeRoundIndex, updateRoundDraft],
  );

  const handleYearChange = useCallback(
    (value: string) => {
      const sanitized = value.replace(/[^0-9]/g, "").slice(0, 4);
      setSeasonYear(sanitized);
      updateRoundDraft(activeRoundIndex, { year: sanitized });
    },
    [activeRoundIndex, updateRoundDraft],
  );

  const puzzleCompleted = useMemo(
    () => roundStates.length > 0 && roundStates.every((state) => state.completed),
    [roundStates],
  );

  const isRoundUnlocked = useCallback(
    (index: number) => {
      if (index <= 0) return true;
      return roundStates.slice(0, index).every((state) => state.completed);
    },
    [roundStates],
  );

  const totalStagesForRound = useMemo(() => {
    if (!currentRound) return 1;
    return resolveTotalStages(currentRound, payload.spec);
  }, [currentRound, payload.spec]);

  const hintRound = useMemo(() => {
    if (!currentRound || !currentState) return 1;
    return currentState.completed
      ? totalStagesForRound
      : resolveHintRound(currentState.stage, totalStagesForRound, accountDifficulty);
  }, [accountDifficulty, currentRound, currentState, totalStagesForRound]);

  const activeHintCount = useMemo(() => {
    if (!currentRound || !currentState) return 0;
    if (totalStagesForRound <= 1) {
      return 0;
    }
    if (currentState.completed) {
      return totalStagesForRound - 1;
    }
    const clampedRound = Math.max(1, Math.min(totalStagesForRound, hintRound));
    return Math.max(0, Math.min(totalStagesForRound - 1, clampedRound - 1));
  }, [currentRound, currentState, hintRound, totalStagesForRound]);

  const posterImageBase = useMemo(() => {
    if (!currentRound || typeof currentRound.mediaId !== "number") {
      return null;
    }
    return `${API_BASE}/puzzles/poster/${currentRound.mediaId}/image`;
  }, [currentRound]);

  const imageSrc = useMemo(() => {
    if (!posterImageBase) {
      return null;
    }
    return `${posterImageBase}?hints=${activeHintCount}`;
  }, [activeHintCount, posterImageBase]);

  const activeHints = useMemo(() => {
    if (!currentRound || !currentState) return [];
    const hints: string[] = [];
    payload.spec
      .filter((spec) => spec.difficulty <= hintRound)
      .forEach((spec) => {
        spec.hints.forEach((hint) => {
          if (hint === "genres" && currentRound.meta.genres.length) {
            const cappedGenres = currentRound.meta.genres.slice(0, 3);
            cappedGenres.forEach((genre) => {
              hints.push(`Genre: ${genre}`);
            });
            if (currentRound.meta.genres.length > cappedGenres.length) {
              hints.push(
                `Genres: +${currentRound.meta.genres.length - cappedGenres.length} more`,
              );
            }
          }
          if (hint === "year" && currentRound.meta.year) {
            hints.push(`Year: ${currentRound.meta.year}`);
          }
          if (hint === "season" && currentRound.meta.season) {
            hints.push(`Season: ${currentRound.meta.season}`);
          }
          if (hint === "format" && currentRound.meta.format) {
            const formattedLabel = formatMediaFormatLabel(currentRound.meta.format);
            hints.push(`Format: ${formattedLabel}`);
          }
        });
      });
    if (currentState.completed) {
      hints.push(`Answer: ${currentState.canonicalTitle}`);
    }
    return Array.from(new Set(hints));
  }, [currentRound, currentState, hintRound, payload.spec]);

  const attemptGuess = useCallback(
    async ({ value, suggestionId }: TitleGuessSelection) => {
      const round = currentRound;
      const state = currentState;
      if (!round || !state) return;
      if (state.completed || submitting) return;
      const trimmed = value.trim();
      if (!trimmed) {
        setRoundStates((prev) =>
          prev.map((entry, index) =>
            index === activeRoundIndex
              ? {
                  ...entry,
                  feedback: {
                    type: "error",
                    message: "Enter a guess before submitting.",
                  },
                }
              : entry,
          ),
        );
        return;
      }

      const normalizedSeason =
        seasonSelection && seasonSelection.trim().length > 0
          ? seasonSelection.trim().toUpperCase()
          : undefined;
      const parsedYear = parseYearInput(seasonYear);

      setSubmitting(true);
      setRoundStates((prev) =>
        prev.map((entry, index) =>
          index === activeRoundIndex ? { ...entry, feedback: null } : entry,
        ),
      );
      try {
        const result = await verifyGuess(round.mediaId, trimmed, suggestionId, {
          season: normalizedSeason,
          seasonYear: parsedYear,
        });
        const matchTitle =
          result.match && result.match.trim().length > 0
            ? result.match
            : round.answer;

        setRoundStates((prev) => {
          const next = prev.map((entry, index) => {
            if (index !== activeRoundIndex) return entry;
            const totalStages = resolveTotalStages(round, payload.spec);
            const yearGuesses =
              parsedYear !== undefined
                ? entry.yearGuesses.includes(parsedYear)
                  ? entry.yearGuesses
                  : [...entry.yearGuesses, parsedYear]
                : entry.yearGuesses;

            if (result.correct) {
              return {
                ...entry,
                guesses: [...entry.guesses, trimmed],
                yearGuesses,
                completed: true,
                canonicalTitle: matchTitle,
                feedback: {
                  type: "success",
                  message: `Poster solved! ${matchTitle}`,
                },
                stage: totalStages,
                hintUsed: true,
                resolvedYear:
                  round.meta.year ?? parsedYear ?? entry.resolvedYear,
              };
            }

            if (result.animeMatch) {
              let partialMessage = "Title correct! ";
              if (result.seasonMatch === false && result.seasonYearMatch === false) {
                partialMessage += "Check the release season and year.";
              } else if (result.seasonMatch === false) {
                partialMessage += "Check the release season.";
              } else if (result.seasonYearMatch === false) {
                partialMessage += "Check the release year.";
              } else {
                partialMessage += "Almost there!";
              }
              return {
                ...entry,
                guesses: [...entry.guesses, trimmed],
                yearGuesses,
                canonicalTitle: matchTitle,
                feedback: { type: "partial", message: partialMessage },
              };
            }

            const nextStage = Math.min(totalStages, entry.stage + 1);
            return {
              ...entry,
              guesses: [...entry.guesses, trimmed],
              yearGuesses,
              feedback: {
                type: "error",
                message: "Not quite. Keep trying!",
              },
              stage: nextStage,
              hintUsed: nextStage > entry.stage ? true : entry.hintUsed,
            };
          });

          if (result.correct) {
            const nextIncomplete = next.findIndex(
              (entry, index) => index > activeRoundIndex && !entry.completed,
            );
            if (next[activeRoundIndex]?.completed && nextIncomplete !== -1) {
              setActiveRoundIndex(nextIncomplete);
            }
          }

          return next;
        });

        if (result.correct) {
          setGuess("");
          setSeasonSelection("");
          setSeasonYear("");
          updateRoundDraft(activeRoundIndex, { guess: "", season: "", year: "" });
        } else if (result.animeMatch) {
          setGuess(matchTitle);
          updateRoundDraft(activeRoundIndex, { guess: matchTitle });
        } else {
          setGuess("");
          updateRoundDraft(activeRoundIndex, { guess: "" });
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to verify your guess. Please try again.";
        setRoundStates((prev) =>
          prev.map((entry, index) =>
            index === activeRoundIndex
              ? { ...entry, feedback: { type: "error", message } }
              : entry,
          ),
        );
      } finally {
        setSubmitting(false);
      }
    },
    [
      activeRoundIndex,
      currentRound,
      currentState,
      payload.spec,
      seasonSelection,
      seasonYear,
      submitting,
      updateRoundDraft,
    ],
  );

  const handleFieldSubmit = useCallback(
    (selection: TitleGuessSelection) => {
      void attemptGuess(selection);
    },
    [attemptGuess],
  );

  const handleGuessSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const round = currentRound;
      const state = currentState;
      if (!round || !state || state.completed || submitting) return;
      const selection = guessFieldRef.current?.submit();
      if (!selection) {
        setRoundStates((prev) =>
          prev.map((entry, index) =>
            index === activeRoundIndex
              ? {
                  ...entry,
                  feedback: {
                    type: "error",
                    message: "Enter a guess before submitting.",
                  },
                }
              : entry,
          ),
        );
        return;
      }
      void attemptGuess(selection);
    },
    [activeRoundIndex, attemptGuess, currentRound, currentState, submitting],
  );

  useEffect(() => {
    const aggregatedGuesses = roundStates.flatMap((state) => state.guesses);
    const roundsProgress: GameRoundProgress[] = roundStates.map((state, index) => ({
      round: index + 1,
      guesses: [...state.guesses],
      titleGuesses: [...state.guesses],
      yearGuesses: state.yearGuesses.length ? [...state.yearGuesses] : undefined,
      stage: state.stage,
      completed: state.completed,
      hintUsed: state.hintUsed,
      resolvedAnswer: state.completed ? state.canonicalTitle : undefined,
      resolvedTitle: state.completed ? state.canonicalTitle : undefined,
      resolvedYear:
        state.completed && state.resolvedYear !== undefined
          ? state.resolvedYear
          : undefined,
    }));
    const activeRoundNumber = roundStates.length
      ? Math.max(1, Math.min(roundStates.length, activeRoundIndex + 1))
      : 1;
    onProgressChange({
      completed: puzzleCompleted,
      round: activeRoundNumber,
      guesses: aggregatedGuesses,
      rounds: roundsProgress,
    });
  }, [activeRoundIndex, onProgressChange, puzzleCompleted, roundStates]);

  const revealMore = useCallback(() => {
    const round = currentRound;
    if (!round) return;
    const totalStages = resolveTotalStages(round, payload.spec);
    setRoundStates((prev) =>
      prev.map((entry, index) => {
        if (index !== activeRoundIndex) return entry;
        if (entry.completed) return entry;
        const nextStage = Math.min(totalStages, entry.stage + 1);
        return {
          ...entry,
          stage: nextStage,
          hintUsed: nextStage > entry.stage ? true : entry.hintUsed,
        };
      }),
    );
  }, [activeRoundIndex, currentRound, payload.spec]);

  if (!currentRound || !currentState) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-neutral-200">
        Unable to load Poster Zoom right now. Please try again later.
      </div>
    );
  }

  const guessesForRound = currentState.guesses;

  return (
    <div className="space-y-5">
      {totalRounds > 1 && (
        <div className="flex flex-wrap gap-2">
          {payload.rounds.map((round, index) => {
            const unlocked = isRoundUnlocked(index);
            const completed = roundStates[index]?.completed;
            const isActive = index === activeRoundIndex;
            return (
              <button
                key={round.mediaId ?? round.order ?? index}
                type="button"
                onClick={() => (unlocked ? setActiveRoundIndex(index) : undefined)}
                disabled={!unlocked}
                className={`inline-flex items-center rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition focus:outline-none focus:ring-2 focus:ring-brand-400/60 ${
                  isActive
                    ? "border-brand-400/60 bg-brand-400/20 text-white"
                    : completed
                      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
                      : unlocked
                        ? "border-white/10 bg-white/5 text-neutral-200 hover:border-brand-400/40 hover:text-white"
                        : "border-white/5 bg-white/5 text-neutral-500 opacity-60"
                }`}
              >
                Round {index + 1}
              </button>
            );
          })}
        </div>
      )}

      <div className="group relative flex h-72 items-center justify-center overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/4 via-white/5 to-white/2 shadow-ambient">
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageSrc}
            alt="Anime poster"
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
          />
        ) : (
          <div className="text-neutral-600">Poster unavailable</div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/0 to-black/40 opacity-70 mix-blend-overlay" />
      </div>

      <div className="flex flex-wrap gap-2 text-xs uppercase tracking-wide text-brand-100/80">
        {activeHints.map((hint) => (
          <span
            key={hint}
            className="rounded-full border border-white/10 bg-white/10 px-3 py-1 font-semibold text-white/90"
          >
            {hint}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:border-brand-400/50 hover:text-brand-100 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={revealMore}
          disabled={currentState.completed || currentState.stage >= totalStagesForRound}
        >
          Reveal More
        </button>
      </div>

      <form onSubmit={handleGuessSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <TitleGuessField
            ref={guessFieldRef}
            className="w-full sm:flex-1"
            value={guess}
            onValueChange={handleGuessChange}
            onSubmit={handleFieldSubmit}
            disabled={currentState.completed || submitting || !currentRound}
            placeholder={
              currentState.completed
                ? "Poster solved!"
                : currentRound
                  ? "Type your guess…"
                  : "Poster unavailable"
            }
            ariaLabel="Poster Zoom guess"
            suggestionsLabel="Poster title suggestions"
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              value={seasonSelection}
              onChange={(event) =>
                handleSeasonChange(event.target.value as SeasonValue)
              }
              disabled={currentState.completed || submitting || !currentRound}
              className="w-full rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-400/60 sm:w-32"
              aria-label="Release season"
            >
              <option value="">Season</option>
              {SEASON_OPTIONS.filter((option) => option).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={seasonYear}
              onChange={(event) => handleYearChange(event.target.value)}
              disabled={currentState.completed || submitting || !currentRound}
              placeholder="Year"
              aria-label="Release year"
              className="w-full rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-400/60 sm:w-24"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-brand-500 via-brand-400 to-cyan-400 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-glow transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={currentState.completed || submitting || !currentRound}
          >
            {submitting ? "Checking…" : "Submit Guess"}
          </button>
        </div>
      </form>

      <div className="space-y-3 text-sm text-neutral-300" aria-live="polite">
        {guessesForRound.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-neutral-500">
            Attempts
            {guessesForRound.map((value, index) => (
              <span
                key={`${value}-${index}`}
                className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[0.7rem] text-neutral-200"
              >
                {value}
              </span>
            ))}
          </div>
        )}
        {currentState.feedback?.type === "error" && (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {currentState.feedback.message}
          </div>
        )}
        {currentState.feedback?.type === "partial" && (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {currentState.feedback.message}
          </div>
        )}
        {currentState.feedback?.type === "success" && (
          <div
            className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
            role="status"
            aria-label={`Poster solved! ${currentState.canonicalTitle}`}
          >
            {currentState.feedback.message}
          </div>
        )}
        {puzzleCompleted && <NextPuzzleButton nextSlug={nextSlug} />}
      </div>
    </div>
  );
}
