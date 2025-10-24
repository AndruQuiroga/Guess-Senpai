"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";

import type { GameProgress } from "../hooks/usePuzzleProgress";
import type { CharacterSilhouetteGame } from "../types/puzzles";
import { verifyGuess } from "../utils/verifyGuess";
import NextPuzzleButton from "./NextPuzzleButton";

interface Props {
  mediaId: number;
  payload: CharacterSilhouetteGame;
  initialProgress?: GameProgress;
  onProgressChange(state: GameProgress): void;
  registerRoundController?: (fn: (round: number) => void) => void;
  nextSlug?: string | null;
}

type FeedbackState =
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | null;

function clampRound(value: number, totalRounds: number): number {
  if (!Number.isFinite(value)) return 1;
  if (totalRounds <= 1) return 1;
  return Math.max(1, Math.min(totalRounds, Math.floor(value)));
}

export default function CharacterSilhouette({
  mediaId,
  payload,
  initialProgress,
  onProgressChange,
  registerRoundController,
  nextSlug,
}: Props) {
  const sortedSpec = useMemo(
    () => [...payload.spec].sort((a, b) => a.difficulty - b.difficulty),
    [payload.spec],
  );

  const totalRounds = Math.max(sortedSpec.length, 1);

  const [round, setRound] = useState(() => {
    const initialRound = initialProgress?.round ?? 1;
    return clampRound(initialRound, totalRounds);
  });
  const [completed, setCompleted] = useState(initialProgress?.completed ?? false);
  const [guess, setGuess] = useState("");
  const [guesses, setGuesses] = useState<string[]>(initialProgress?.guesses ?? []);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setRound((prev) => clampRound(prev, totalRounds));
  }, [totalRounds]);

  useEffect(() => {
    if (!initialProgress) {
      setRound(1);
      setCompleted(false);
      setGuesses([]);
      setGuess("");
      setFeedback(null);
      return;
    }

    setRound(clampRound(initialProgress.round ?? 1, totalRounds));
    setCompleted(initialProgress.completed ?? false);
    setGuesses(initialProgress.guesses ?? []);
    setGuess("");
    if (initialProgress.completed) {
      setFeedback({
        type: "success",
        message: `Silhouette solved! ${payload.answer}`,
      });
    } else {
      setFeedback(null);
    }
  }, [initialProgress, payload.answer, totalRounds]);

  useEffect(() => {
    if (!registerRoundController) return;
    registerRoundController((targetRound) => {
      setRound(clampRound(targetRound, totalRounds));
    });
  }, [registerRoundController, totalRounds]);

  useEffect(() => {
    onProgressChange({ completed, round, guesses });
  }, [completed, round, guesses, onProgressChange]);

  const currentStage = useMemo(() => {
    if (sortedSpec.length === 0) {
      return null;
    }
    if (completed) {
      return sortedSpec[sortedSpec.length - 1];
    }
    return sortedSpec.reduce((acc, spec) => {
      if (spec.difficulty <= round) {
        return spec;
      }
      return acc;
    }, sortedSpec[0]);
  }, [sortedSpec, round, completed]);

  const filterStyle = useMemo(() => {
    if (!currentStage) {
      return "none";
    }
    if (completed) {
      return sortedSpec[sortedSpec.length - 1]?.filter ?? "none";
    }
    return currentStage.filter ?? "none";
  }, [completed, currentStage, sortedSpec]);

  const unlockedStages = useMemo(
    () =>
      sortedSpec.filter((stage) => {
        if (completed) return true;
        return stage.difficulty <= round;
      }),
    [sortedSpec, completed, round],
  );

  const handleRevealMore = useCallback(() => {
    setRound((prev) => clampRound(prev + 1, totalRounds));
  }, [totalRounds]);

  const normalizeText = useCallback((input: string) => {
    const trimmed = input.trim().toLowerCase();
    const withoutDiacritics = trimmed.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return {
      base: trimmed,
      stripped: withoutDiacritics,
    };
  }, []);

  const normalizedCharacterNames = useMemo(() => {
    const variants = new Set<string>();
    const { base, stripped } = normalizeText(payload.character.name);
    if (base) {
      variants.add(base);
    }
    if (stripped) {
      variants.add(stripped);
    }
    return Array.from(variants);
  }, [normalizeText, payload.character.name]);

  const handleGuessSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (completed || submitting) return;

      const value = guess.trim();
      if (!value) {
        setFeedback({
          type: "error",
          message: "Enter a guess before submitting.",
        });
        return;
      }

      setSubmitting(true);
      setFeedback(null);

      try {
        const normalizedGuess = normalizeText(value);
        const directMatch =
          normalizedCharacterNames.includes(normalizedGuess.base) ||
          normalizedCharacterNames.includes(normalizedGuess.stripped);

        if (directMatch) {
          setGuesses((prev) => [...prev, value]);
          setCompleted(true);
          setRound(totalRounds);
          setFeedback({
            type: "success",
            message: `Silhouette solved! ${payload.answer}`,
          });
          setGuess("");
          return;
        }

        const result = await verifyGuess(mediaId, value);
        setGuesses((prev) => [...prev, value]);
        if (result.correct) {
          setCompleted(true);
          setRound(totalRounds);
          setFeedback({
            type: "success",
            message: `Silhouette solved! ${payload.answer}`,
          });
        } else {
          setFeedback({
            type: "error",
            message: "Not quite. The lights brighten a little more.",
          });
          setRound((prev) => clampRound(prev + 1, totalRounds));
        }
        setGuess("");
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to verify your guess. Please try again.";
        setFeedback({ type: "error", message });
      } finally {
        setSubmitting(false);
      }
    },
    [
      completed,
      submitting,
      guess,
      mediaId,
      normalizedCharacterNames,
      normalizeText,
      payload.answer,
      totalRounds,
    ],
  );

  const revealLabel = completed
    ? "Fully revealed"
    : currentStage?.label ?? "Silhouette";

  return (
    <div className="space-y-5">
      <div className="group relative flex h-80 items-center justify-center overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/4 via-white/6 to-white/10 shadow-ambient">
        {payload.character.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={payload.character.image}
            alt={`Silhouette of ${payload.character.name}`}
            className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.03]"
            style={{ filter: filterStyle }}
          />
        ) : (
          <div className="text-neutral-600">Character artwork unavailable</div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-black/40 opacity-70 mix-blend-overlay" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-between p-4 text-xs uppercase tracking-[0.3em] text-white/80">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-4 py-1 font-semibold backdrop-blur">
            {revealLabel}
          </span>
          {payload.character.role ? (
            <span className="hidden items-center gap-2 rounded-full border border-white/15 bg-black/30 px-4 py-1 font-semibold backdrop-blur sm:inline-flex">
              Role: {payload.character.role}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs uppercase tracking-wide text-brand-100/80">
        {unlockedStages.map((stage) => (
          <span
            key={stage.difficulty}
            className="rounded-full border border-white/10 bg-white/10 px-3 py-1 font-semibold text-white/90"
          >
            {stage.description ?? stage.label}
          </span>
        ))}
        {payload.character.role && (completed || round >= Math.min(2, totalRounds)) ? (
          <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 font-semibold text-white/90">
            Role: {payload.character.role}
          </span>
        ) : null}
        {completed ? (
          <span className="rounded-full border border-brand-400/60 bg-brand-500/15 px-3 py-1 font-semibold text-brand-100">
            Answer: {payload.answer}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:border-brand-400/50 hover:text-brand-100 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={handleRevealMore}
          disabled={completed || round >= totalRounds}
        >
          Reveal More
        </button>
      </div>

      <form onSubmit={handleGuessSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-400/20 disabled:cursor-not-allowed disabled:opacity-70"
          placeholder={completed ? "Silhouette solved!" : "Type your guess…"}
          value={guess}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setGuess(event.target.value)}
          disabled={completed || submitting}
          aria-label="Character silhouette guess"
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-brand-500 via-brand-400 to-cyan-400 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-glow transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70"
          disabled={completed || submitting}
        >
          Submit
        </button>
      </form>

      {!completed ? (
        <div className="space-y-3 text-sm text-neutral-300" aria-live="polite">
          {guesses.length > 0 ? (
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
          ) : null}
        </div>
      ) : null}

      {feedback ? (
        <div
          role="status"
          className={`rounded-2xl border px-4 py-3 text-sm ${
            feedback.type === "success"
              ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
              : "border-rose-400/40 bg-rose-500/10 text-rose-100"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      {completed ? (
        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-neutral-100">
          <p className="font-semibold text-white">
            Character: {payload.character.name}
          </p>
          <p className="text-neutral-300">
            You recognized the series as {payload.answer}. Nicely done!
          </p>
          <NextPuzzleButton nextSlug={nextSlug} className="w-full justify-center" />
        </div>
      ) : null}
    </div>
  );
}
