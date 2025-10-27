"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";

import { GameProgress } from "../hooks/usePuzzleProgress";
import { PosterZoomGame as PosterPayload } from "../types/puzzles";
import { formatMediaFormatLabel } from "../utils/formatMediaFormatLabel";
import { verifyGuess } from "../utils/verifyGuess";
import NextPuzzleButton from "./NextPuzzleButton";

interface Props {
  mediaId: number;
  payload: PosterPayload;
  initialProgress?: GameProgress;
  onProgressChange(state: GameProgress): void;
  registerRoundController?: (fn: (round: number) => void) => void;
  nextSlug?: string | null;
}

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
  nextSlug,
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

  const totalRounds = useMemo(() => {
    if (payload.spec.length > 0) {
      return payload.spec.length;
    }
    if (payload.cropStages && payload.cropStages.length > 0) {
      return payload.cropStages.length;
    }
    return 3;
  }, [payload.cropStages, payload.spec.length]);

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
      setRound(() => Math.max(1, Math.min(totalRounds, targetRound)));
    });
  }, [registerRoundController, totalRounds]);

  useEffect(() => {
    onProgressChange({ completed, round, guesses });
  }, [completed, round, guesses, onProgressChange]);

  const cropStages = payload.cropStages ?? [];

  const fallbackZoom = useMemo(() => {
    if (completed) return 1;
    const initialScale = 1.35;
    if (totalRounds <= 1) {
      return 1;
    }
    const clampedRound = Math.max(1, Math.min(totalRounds, round));
    const progress = (clampedRound - 1) / (totalRounds - 1);
    return initialScale + (1 - initialScale) * progress;
  }, [completed, round, totalRounds]);

  const activeCropStage = useMemo(() => {
    if (!cropStages.length) {
      return null;
    }
    if (completed) {
      return cropStages[cropStages.length - 1];
    }
    const index = Math.max(0, Math.min(cropStages.length - 1, round - 1));
    return cropStages[index];
  }, [completed, cropStages, round]);

  const imageTransform = useMemo(() => {
    if (!activeCropStage) {
      return {
        scale: fallbackZoom,
        objectPosition: undefined as string | undefined,
        transformOrigin: undefined as string | undefined,
      };
    }
    const position = `${activeCropStage.offset_x}% ${activeCropStage.offset_y}%`;
    return {
      scale: activeCropStage.scale,
      objectPosition: position,
      transformOrigin: position,
    };
  }, [activeCropStage, fallbackZoom]);

  const blurRadius = useMemo(() => {
    if (completed) {
      return 0;
    }
    if (totalRounds <= 1) {
      return 0;
    }
    const clampedRound = Math.max(1, Math.min(totalRounds, round));
    const progress = (clampedRound - 1) / (totalRounds - 1);
    const maxBlur = 14;
    const remaining = 1 - progress;
    return Number((remaining * maxBlur).toFixed(2));
  }, [completed, round, totalRounds]);

  const activeHints = useMemo(() => {
    const hints: string[] = [];
    payload.spec
      .filter((spec) => spec.difficulty <= round || completed)
      .forEach((spec) => {
        spec.hints.forEach((hint) => {
          if (hint === "genres" && payload.meta.genres.length) {
            const cappedGenres = payload.meta.genres.slice(0, 3);
            cappedGenres.forEach((genre) => {
              hints.push(`Genre: ${genre}`);
            });
            if (payload.meta.genres.length > cappedGenres.length) {
              hints.push(`Genres: +${payload.meta.genres.length - cappedGenres.length} more`);
            }
          }
          if (hint === "year" && payload.meta.year) {
            hints.push(`Year: ${payload.meta.year}`);
          }
          if (hint === "format" && payload.meta.format) {
            const formattedLabel = formatMediaFormatLabel(payload.meta.format);
            hints.push(`Format: ${formattedLabel}`);
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
          const acceptedTitle = result.match ?? payload.answer;
          setFeedback({
            type: "success",
            message: `Poster solved! ${acceptedTitle}`,
          });
        } else {
          setFeedback({ type: "error", message: "Not quite. Keep trying!" });
          setRound((prev) => (prev >= totalRounds ? totalRounds : prev + 1));
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
    [completed, guess, mediaId, payload.answer, submitting, totalRounds],
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
            style={{
              transform: `scale(${imageTransform.scale})`,
              transformOrigin: imageTransform.transformOrigin,
              objectPosition: imageTransform.objectPosition,
              filter: `blur(${blurRadius}px)`,
            }}
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
            setRound((prev) => (prev >= totalRounds ? totalRounds : prev + 1))
          }
          disabled={completed || round === totalRounds}
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
          <div
            className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
            role="status"
            aria-label={`Poster solved! ${payload.answer}`}
          >
            {feedback.message}
          </div>
        )}
        {completed && <NextPuzzleButton nextSlug={nextSlug} />}
      </div>
    </div>
  );
}
