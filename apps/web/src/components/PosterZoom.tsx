"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { GameProgress } from "../hooks/usePuzzleProgress";
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

interface Props {
  mediaId: number;
  payload: PosterPayload;
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

export default function PosterZoom({
  mediaId,
  payload,
  initialProgress,
  onProgressChange,
  registerRoundController,
  nextSlug,
  accountDifficulty,
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
  const guessFieldRef = useRef<TitleGuessFieldHandle | null>(null);

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

  const hintRound = useMemo(
    () =>
      completed
        ? totalRounds
        : resolveHintRound(round, totalRounds, accountDifficulty),
    [accountDifficulty, completed, round, totalRounds],
  );

  const posterImageBase = useMemo(
    () => `${API_BASE}/puzzles/poster/${mediaId}/image`,
    [mediaId],
  );

  const activeHintCount = useMemo(() => {
    if (totalRounds <= 1) {
      return 0;
    }
    if (completed) {
      return totalRounds - 1;
    }
    const clampedRound = Math.max(1, Math.min(totalRounds, hintRound));
    return Math.max(0, Math.min(totalRounds - 1, clampedRound - 1));
  }, [completed, hintRound, totalRounds]);

  const imageSrc = useMemo(() => {
    return `${posterImageBase}?hints=${activeHintCount}`;
  }, [activeHintCount, posterImageBase]);

  const activeHints = useMemo(() => {
    const hints: string[] = [];
    payload.spec
      .filter((spec) => spec.difficulty <= hintRound)
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
  }, [completed, hintRound, payload]);

  const attemptGuess = useCallback(
    async ({ value, suggestionId }: TitleGuessSelection) => {
      if (completed || submitting) return;
      const trimmed = value.trim();
      if (!trimmed) {
        setFeedback({
          type: "error",
          message: "Enter a guess before submitting.",
        });
        return;
      }

      setSubmitting(true);
      setFeedback(null);
      try {
        const result = await verifyGuess(mediaId, trimmed, suggestionId);
        setGuesses((prev) => [...prev, trimmed]);
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
    [completed, mediaId, payload.answer, submitting, totalRounds],
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
      if (completed || submitting) return;
      const selection = guessFieldRef.current?.submit();
      if (!selection) {
        setFeedback({
          type: "error",
          message: "Enter a guess before submitting.",
        });
        return;
      }
      void attemptGuess(selection);
    },
    [attemptGuess, completed, submitting],
  );

  return (
    <div className="space-y-5">
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
        <TitleGuessField
          ref={guessFieldRef}
          className="w-full"
          value={guess}
          onValueChange={setGuess}
          onSubmit={handleFieldSubmit}
          disabled={completed || submitting}
          placeholder={completed ? "Poster solved!" : "Type your guess…"}
          ariaLabel="Poster Zoom guess"
          suggestionsLabel="Poster title suggestions"
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
