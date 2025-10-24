"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";

import { GameProgress } from "../hooks/usePuzzleProgress";
import { PosterZoomGame as PosterPayload } from "../types/puzzles";
import { verifyGuess } from "../utils/verifyGuess";

interface Props {
  mediaId: number;
  payload: PosterPayload;
  initialProgress?: GameProgress;
  onProgressChange(state: GameProgress): void;
  registerRoundController?: (fn: (round: number) => void) => void;
}

const TOTAL_ROUNDS = 3;

type FeedbackState =
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | null;

export default function PosterZoom({
  mediaId,
  payload,
  initialProgress,
  onProgressChange,
  registerRoundController,
}: Props) {
  const [round, setRound] = useState(initialProgress?.round ?? 1);
  const [completed, setCompleted] = useState(
    initialProgress?.completed ?? false,
  );
  const [guess, setGuess] = useState("");
  const [guesses, setGuesses] = useState<string[]>(
    initialProgress?.guesses ?? [],
  );
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!initialProgress) {
      setRound(1);
      setCompleted(false);
      setGuesses([]);
      setGuess("");
      setFeedback(null);
      return;
    }
    setRound(initialProgress.round ?? 1);
    setCompleted(initialProgress.completed ?? false);
    setGuesses(initialProgress.guesses ?? []);
    setGuess("");
    if (initialProgress.completed) {
      setFeedback({
        type: "success",
        message: `Poster solved! ${payload.answer}`,
      });
    } else {
      setFeedback(null);
    }
  }, [initialProgress, payload.answer]);

  useEffect(() => {
    if (!registerRoundController) return;
    registerRoundController((targetRound) => {
      setRound(() => Math.max(1, Math.min(TOTAL_ROUNDS, targetRound)));
    });
  }, [registerRoundController]);

  useEffect(() => {
    onProgressChange({ completed, round, guesses });
  }, [completed, round, guesses, onProgressChange]);

  const zoom = useMemo(() => {
    if (completed) return 1;
    if (round === 1) return 1.35;
    if (round === 2) return 1.15;
    return 1;
  }, [completed, round]);

  const activeHints = useMemo(() => {
    const hints: string[] = [];
    payload.spec
      .filter((spec) => spec.difficulty <= round || completed)
      .forEach((spec) => {
        spec.hints.forEach((hint) => {
          if (hint === "genres" && payload.meta.genres.length) {
            hints.push(`Genres: ${payload.meta.genres.join(", ")}`);
          }
          if (hint === "year" && payload.meta.year) {
            hints.push(`Year: ${payload.meta.year}`);
          }
          if (hint === "format" && payload.meta.format) {
            hints.push(`Format: ${payload.meta.format}`);
          }
        });
      });
    if (completed) {
      hints.push(`Answer: ${payload.answer}`);
    }
    return Array.from(new Set(hints));
  }, [completed, payload, round]);

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
        const result = await verifyGuess(mediaId, value);
        setGuesses((prev) => [...prev, value]);
        if (result.correct) {
          setCompleted(true);
          setFeedback({
            type: "success",
            message: `Poster solved! ${payload.answer}`,
          });
        } else {
          setFeedback({ type: "error", message: "Not quite. Keep trying!" });
          setRound((prev) => (prev >= TOTAL_ROUNDS ? TOTAL_ROUNDS : prev + 1));
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
    [completed, guess, mediaId, payload.answer, submitting],
  );

  return (
    <div className="space-y-5">
      <div className="group relative flex h-72 items-center justify-center overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/4 via-white/5 to-white/2 shadow-ambient">
        {payload.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={payload.image}
            alt="Anime poster"
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
            style={{ transform: `scale(${zoom})` }}
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
          onClick={() =>
            setRound((prev) => (prev >= TOTAL_ROUNDS ? TOTAL_ROUNDS : prev + 1))
          }
          disabled={completed || round === TOTAL_ROUNDS}
        >
          Reveal More
        </button>
      </div>
      <form
        onSubmit={handleGuessSubmit}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <input
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-400/20 disabled:cursor-not-allowed disabled:opacity-70"
          placeholder={completed ? "Poster solved!" : "Type your guess…"}
          value={guess}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setGuess(event.target.value)}
          disabled={completed || submitting}
          aria-label="Poster Zoom guess"
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-brand-500 via-brand-400 to-cyan-400 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-glow transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={completed || submitting}
        >
          {submitting ? "Checking…" : "Submit Guess"}
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
        {feedback?.type === "error" && (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {feedback.message}
          </div>
        )}
        {feedback?.type === "success" && (
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {feedback.message}
          </div>
        )}
      </div>
    </div>
  );
}
