"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { GameProgress, GameRoundProgress } from "../hooks/usePuzzleProgress";
import { GuessOpeningRound } from "../types/puzzles";
import { resolveHintRound } from "../utils/difficulty";
import { verifyGuess } from "../utils/verifyGuess";
import NextPuzzleButton from "./NextPuzzleButton";
import {
  TitleGuessField,
  type TitleGuessFieldHandle,
  type TitleGuessSelection,
} from "./games/TitleGuessField";

interface Props {
  payload: GuessOpeningRound[];
  initialProgress?: GameProgress;
  onProgressChange(state: GameProgress): void;
  registerRoundController?: (fn: (round: number) => void) => void;
  nextSlug?: string | null;
  accountDifficulty?: number;
}

type FeedbackState =
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | null;

interface RoundState {
  guesses: string[];
  stage: number;
  completed: boolean;
  canonicalTitle: string;
  feedback: FeedbackState;
  hintUsed: boolean;
}

function createDefaultRoundState(round: GuessOpeningRound): RoundState {
  return {
    guesses: [],
    stage: 1,
    completed: false,
    canonicalTitle: round.answer,
    feedback: null,
    hintUsed: false,
  };
}

export default function GuessOpening({
  payload,
  initialProgress,
  onProgressChange,
  registerRoundController,
  nextSlug,
  accountDifficulty,
}: Props) {
  const totalRounds = useMemo(() => {
    return payload.length > 0 ? payload.length : 1;
  }, [payload.length]);

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
    payload.map((round) => createDefaultRoundState(round)),
  );
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
            (guess): guess is string =>
              typeof guess === "string" && guess.trim().length > 0,
          )
        : null;
      const storedGuesses = storedTitleGuesses?.length
        ? storedTitleGuesses
        : Array.isArray(entry.guesses)
          ? entry.guesses.filter(
              (guess): guess is string =>
                typeof guess === "string" && guess.trim().length > 0,
            )
          : [];
      const storedYearGuesses = Array.isArray(entry.yearGuesses)
        ? entry.yearGuesses.filter(
            (guess): guess is number =>
              typeof guess === "number" && Number.isFinite(guess),
          )
        : null;
      map.set(normalizedRound, {
        round: normalizedRound,
        guesses: [...storedGuesses],
        titleGuesses: storedTitleGuesses?.length
          ? [...storedTitleGuesses]
          : undefined,
        yearGuesses: storedYearGuesses?.length
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
  const [guess, setGuess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const guessFieldRef = useRef<TitleGuessFieldHandle | null>(null);

  useEffect(() => {
    const fallbackIndex = clampRoundIndex((initialProgress?.round ?? 1) - 1);
    const fallbackGuesses =
      initialProgress && Array.isArray(initialProgress.guesses)
        ? [...initialProgress.guesses]
        : [];
    const markAllCompleted =
      Boolean(initialProgress?.completed) && storedRoundMap.size === 0;

    setRoundStates((prev) =>
      payload.map((round, index) => {
        const baseState = createDefaultRoundState(round);
        const previous = prev[index] ?? baseState;
        const stored = storedRoundMap.get(index + 1);
        const totalStages = Math.max(round.spec.length, 1);

        let guesses = previous.guesses;
        if (stored) {
          const storedGuesses = Array.isArray(stored.titleGuesses)
            ? stored.titleGuesses.filter(
                (guess): guess is string =>
                  typeof guess === "string" && guess.trim().length > 0,
              )
            : Array.isArray(stored.guesses)
              ? stored.guesses.filter(
                  (guess): guess is string =>
                    typeof guess === "string" && guess.trim().length > 0,
                )
              : [];
          guesses = [...storedGuesses];
        } else if (
          initialProgress &&
          storedRoundMap.size === 0 &&
          index === fallbackIndex
        ) {
          guesses = [...fallbackGuesses];
        }

        let completed = previous.completed;
        if (stored?.completed !== undefined) {
          completed = Boolean(stored.completed);
        } else if (markAllCompleted) {
          completed = true;
        } else if (!initialProgress) {
          completed = false;
        }

        let stage = previous.stage;
        if (stored?.stage !== undefined && Number.isFinite(stored.stage)) {
          const normalizedStage = Math.floor(stored.stage ?? 1);
          stage = Math.max(1, Math.min(totalStages, normalizedStage));
        } else if (completed) {
          stage = totalStages;
        } else {
          stage = Math.max(1, Math.min(totalStages, stage));
        }

        let hintUsed = previous.hintUsed;
        if (stored?.hintUsed !== undefined) {
          hintUsed = Boolean(stored.hintUsed);
        } else if (completed || stage > 1) {
          hintUsed = true;
        }

        const resolvedAnswer = (
          stored?.resolvedTitle ?? stored?.resolvedAnswer
        )?.trim();
        const canonicalTitle = resolvedAnswer
          ? resolvedAnswer
          : completed
            ? previous.canonicalTitle || round.answer
            : round.answer;

        const feedback = completed
          ? {
              type: "success" as const,
              message: `Opening solved! ${canonicalTitle}`,
            }
          : previous.completed && !completed
            ? null
            : previous.feedback && !completed
              ? previous.feedback
              : null;

        return {
          ...baseState,
          guesses,
          completed,
          stage,
          canonicalTitle,
          feedback,
          hintUsed,
        };
      }),
    );

    setActiveRoundIndex(() => fallbackIndex);
    setGuess("");
  }, [clampRoundIndex, initialProgress, payload, storedRoundMap]);

  useEffect(() => {
    if (!registerRoundController) return;
    registerRoundController((targetRound) => {
      setActiveRoundIndex(() => clampRoundIndex(targetRound - 1));
    });
  }, [clampRoundIndex, registerRoundController, totalRounds]);

  const currentRound = payload[activeRoundIndex];
  const currentState = roundStates[activeRoundIndex];

  const totalStages = useMemo(() => {
    if (!currentRound) return 1;
    const specLength = currentRound.spec.length;
    return specLength > 0 ? specLength : 1;
  }, [currentRound]);

  const hintRound = useMemo(() => {
    if (!currentRound || !currentState) return 1;
    return currentState.completed
      ? totalStages
      : resolveHintRound(currentState.stage, totalStages, accountDifficulty);
  }, [accountDifficulty, currentRound, currentState, totalStages]);

  const hints = useMemo(() => {
    if (!currentRound || !currentState) return [];
    const badges: string[] = [];
    currentRound.spec
      .filter((spec) => spec.difficulty <= hintRound)
      .forEach((spec) => {
        spec.hints.forEach((hint) => {
          if (hint === "length" && currentRound.clip.lengthSeconds) {
            badges.push(`Length: ${currentRound.clip.lengthSeconds}s`);
          }
          if (hint === "season" && currentRound.meta.season) {
            badges.push(currentRound.meta.season);
          }
          if (hint === "artist" && currentRound.meta.artist) {
            badges.push(`Artist: ${currentRound.meta.artist}`);
          }
          if (hint === "song" && currentRound.meta.songTitle) {
            badges.push(`Song: ${currentRound.meta.songTitle}`);
          }
          if (hint === "sequence" && currentRound.meta.sequence) {
            badges.push(`OP ${currentRound.meta.sequence}`);
          }
        });
      });
    if (currentState.completed) {
      badges.push(`Answer: ${currentState.canonicalTitle}`);
    }
    return Array.from(new Set(badges));
  }, [currentRound, currentState, hintRound]);

  const guessesForRound = currentState?.guesses ?? [];
  const roundHintUsed = Boolean(currentState?.hintUsed);
  const puzzleCompleted = useMemo(
    () =>
      roundStates.length > 0 && roundStates.every((state) => state.completed),
    [roundStates],
  );

  const clip = currentRound?.clip;
  const clipMimeType = clip?.mimeType ?? undefined;
  const audioSource = clip?.audioUrl ?? clip?.videoUrl ?? undefined;
  const audioMimeType = clip?.audioUrl
    ? (clipMimeType ?? "audio/mpeg")
    : clip?.videoUrl
      ? (clipMimeType ?? "video/mp4")
      : undefined;
  const videoSource = clip?.videoUrl ?? undefined;
  const hasMedia = Boolean(audioSource || videoSource);
  const canRevealVideo =
    currentState.completed ||
    (guessesForRound?.length ?? 0) >= 2 ||
    roundHintUsed;

  const attemptGuess = useCallback(
    async ({ value, suggestionId }: TitleGuessSelection) => {
      const round = payload[activeRoundIndex];
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

      setSubmitting(true);
      setRoundStates((prev) =>
        prev.map((entry, index) =>
          index === activeRoundIndex ? { ...entry, feedback: null } : entry,
        ),
      );
      try {
        const result = await verifyGuess(round.mediaId, trimmed, suggestionId);
        if (result.correct) {
          const matchTitle = result.match?.trim() ? result.match : round.answer;
          setRoundStates((prev) =>
            prev.map((entry, index) => {
              if (index !== activeRoundIndex) return entry;
              return {
                ...entry,
                guesses: [...entry.guesses, trimmed],
                completed: true,
                canonicalTitle: matchTitle,
                feedback: {
                  type: "success",
                  message: `Opening solved! ${matchTitle}`,
                },
                stage: totalStages,
                hintUsed: true,
              };
            }),
          );
        } else {
          setRoundStates((prev) =>
            prev.map((entry, index) => {
              if (index !== activeRoundIndex) return entry;
              const nextStage = Math.min(totalStages, entry.stage + 1);
              return {
                ...entry,
                guesses: [...entry.guesses, trimmed],
                stage: nextStage,
                feedback: {
                  type: "error",
                  message: "No match yet. Try another guess!",
                },
                hintUsed: entry.hintUsed,
              };
            }),
          );
        }
        setGuess("");
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to verify your guess. Please try again.";
        setRoundStates((prev) =>
          prev.map((entry, index) =>
            index === activeRoundIndex
              ? {
                  ...entry,
                  feedback: { type: "error", message },
                }
              : entry,
          ),
        );
      } finally {
        setSubmitting(false);
      }
    },
    [activeRoundIndex, currentState, payload, submitting, totalStages],
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
      const state = currentState;
      if (!state || state.completed || submitting) return;
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
    [activeRoundIndex, attemptGuess, currentState, submitting],
  );

  useEffect(() => {
    const aggregatedGuesses = roundStates.flatMap((state) => state.guesses);
    const roundsProgress: GameRoundProgress[] = roundStates.map(
      (state, index) => ({
        round: index + 1,
        guesses: [...state.guesses],
        titleGuesses: [...state.guesses],
        stage: state.stage,
        completed: state.completed,
        hintUsed: state.hintUsed,
        resolvedAnswer: state.completed ? state.canonicalTitle : undefined,
        resolvedTitle: state.completed ? state.canonicalTitle : undefined,
        yearGuesses: storedRoundMap.get(index + 1)?.yearGuesses?.length
          ? [...(storedRoundMap.get(index + 1)?.yearGuesses ?? [])]
          : undefined,
      }),
    );
    onProgressChange({
      completed: puzzleCompleted,
      round: activeRoundIndex + 1,
      guesses: aggregatedGuesses,
      rounds: roundsProgress,
    });
  }, [
    activeRoundIndex,
    onProgressChange,
    puzzleCompleted,
    roundStates,
    storedRoundMap,
  ]);

  useEffect(() => {
    setGuess("");
    guessFieldRef.current?.close();
  }, [activeRoundIndex]);

  const revealMore = useCallback(() => {
    const round = payload[activeRoundIndex];
    if (!round) return;
    setRoundStates((prev) =>
      prev.map((entry, index) => {
        if (index !== activeRoundIndex) return entry;
        const specLength = round.spec.length || 1;
        const nextStage = Math.min(specLength, entry.stage + 1);
        return {
          ...entry,
          stage: nextStage,
          hintUsed: true,
        };
      }),
    );
  }, [activeRoundIndex, payload]);

  if (!currentRound || !currentState) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-neutral-200">
        Unable to load Guess the Opening right now. Please try again later.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {totalRounds > 1 && (
        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-neutral-300">
          {payload.map((round, index) => {
            const state = roundStates[index];
            const isActive = index === activeRoundIndex;
            return (
              <button
                key={`${round.mediaId}-${index}`}
                type="button"
                className={`rounded-full border px-4 py-1.5 transition ${
                  isActive
                    ? "border-brand-400/70 bg-brand-500/20 text-white"
                    : state?.completed
                      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                      : "border-white/10 bg-white/5 text-white/70 hover:border-white/20"
                }`}
                onClick={() => setActiveRoundIndex(index)}
              >
                Opening {index + 1}
              </button>
            );
          })}
        </div>
      )}
      {hasMedia ? (
        <div className="space-y-3 rounded-[1.8rem] border border-white/10 bg-gradient-to-br from-white/8 via-white/5 to-transparent p-5 backdrop-blur-xl">
          {audioSource && (
            <audio
              controls
              preload="none"
              className="w-full rounded-2xl bg-black/40 px-4 py-3 text-sm text-neutral-200 shadow-inner shadow-brand-500/20"
            >
              <source src={audioSource} type={audioMimeType} />
              Your browser does not support the audio element.
            </audio>
          )}
          {videoSource ? (
            canRevealVideo ? (
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/60">
                <div
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.25),_transparent_65%)]"
                  aria-hidden="true"
                />
                <video
                  controls
                  preload="none"
                  playsInline
                  className="relative z-[1] w-full rounded-2xl border border-white/5 bg-black/60 text-sm text-neutral-200 shadow-inner shadow-brand-500/20 filter saturate-0 blur-sm contrast-[1.35]"
                >
                  <source
                    src={videoSource}
                    type={clipMimeType ?? "video/mp4"}
                  />
                  Your browser does not support the video element.
                </video>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/15 bg-black/40 px-4 py-6 text-center text-sm text-neutral-300">
                Guess twice or use Reveal More to unlock the video.
              </div>
            )
          ) : null}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-neutral-300">
          No clip available for this title today.
        </div>
      )}
      <div className="flex flex-wrap gap-2 text-xs uppercase tracking-wide text-brand-100/80">
        {hints.map((hint) => (
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
          disabled={currentState.completed || currentState.stage >= totalStages}
        >
          Reveal More
        </button>
      </div>
      <form
        onSubmit={handleGuessSubmit}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <TitleGuessField
          ref={guessFieldRef}
          className="w-full"
          value={guess}
          onValueChange={setGuess}
          onSubmit={handleFieldSubmit}
          disabled={currentState.completed || submitting}
          placeholder={
            currentState.completed
              ? `Opening solved! ${currentState.canonicalTitle}`
              : "Type your guess…"
          }
          ariaLabel={
            currentState.completed
              ? `Opening solved: ${currentState.canonicalTitle}`
              : "Guess the opening"
          }
          suggestionsLabel="Opening title suggestions"
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-brand-500 via-brand-400 to-cyan-400 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-glow transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={currentState.completed || submitting}
        >
          {submitting ? "Checking…" : "Submit Guess"}
        </button>
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
        {currentState.feedback?.type === "success" && (
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {currentState.feedback.message}
          </div>
        )}
        {puzzleCompleted && <NextPuzzleButton nextSlug={nextSlug} />}
      </div>
    </div>
  );
}
