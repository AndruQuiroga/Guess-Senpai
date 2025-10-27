"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { GameProgress } from "../hooks/usePuzzleProgress";
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
  payload: GuessOpeningRound;
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

export default function GuessOpening({
  payload,
  initialProgress,
  onProgressChange,
  registerRoundController,
  nextSlug,
  accountDifficulty,
}: Props) {
  const totalRounds = useMemo(() => {
    const specLength = payload.spec.length;
    return specLength > 0 ? specLength : 3;
  }, [payload.spec]);

  const [round, setRound] = useState(initialProgress?.round ?? 1);
  const [completed, setCompleted] = useState(
    initialProgress?.completed ?? false,
  );
  const [guess, setGuess] = useState("");
  const [guesses, setGuesses] = useState<string[]>(
    initialProgress?.guesses ?? [],
  );
  const [canonicalTitle, setCanonicalTitle] = useState(payload.answer);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [submitting, setSubmitting] = useState(false);
  const guessFieldRef = useRef<TitleGuessFieldHandle | null>(null);

  useEffect(() => {
    if (!initialProgress) {
      setRound(1);
      setCompleted(false);
      setGuesses([]);
      setGuess("");
      setCanonicalTitle(payload.answer);
      setFeedback(null);
      return;
    }
    setRound(initialProgress.round ?? 1);
    setCompleted(initialProgress.completed ?? false);
    setGuesses(initialProgress.guesses ?? []);
    setGuess("");
    const solvedTitle = payload.answer;
    setCanonicalTitle(solvedTitle);
    if (initialProgress.completed) {
      setFeedback({
        type: "success",
        message: `Opening solved! ${solvedTitle}`,
      });
    } else {
      setFeedback(null);
    }
  }, [initialProgress, payload.answer, payload.mediaId]);

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

  const hints = useMemo(() => {
    const badges: string[] = [];
    payload.spec
      .filter((spec) => spec.difficulty <= hintRound)
      .forEach((spec) => {
        spec.hints.forEach((hint) => {
          if (hint === "length" && payload.clip.lengthSeconds) {
            badges.push(`Length: ${payload.clip.lengthSeconds}s`);
          }
          if (hint === "season" && payload.meta.season) {
            badges.push(payload.meta.season);
          }
          if (hint === "artist" && payload.meta.artist) {
            badges.push(`Artist: ${payload.meta.artist}`);
          }
          if (hint === "song" && payload.meta.songTitle) {
            badges.push(`Song: ${payload.meta.songTitle}`);
          }
          if (hint === "sequence" && payload.meta.sequence) {
            badges.push(`OP ${payload.meta.sequence}`);
          }
        });
      });
    if (completed) {
      badges.push(`Answer: ${canonicalTitle}`);
    }
    return Array.from(new Set(badges));
  }, [canonicalTitle, completed, hintRound, payload]);

  const clip = payload.clip;
  const clipMimeType = clip.mimeType ?? undefined;
  const shouldUseAudio = Boolean(
    clip.audioUrl && (clipMimeType ? clipMimeType.startsWith("audio/") : true),
  );
  const mediaSrc = shouldUseAudio
    ? (clip.audioUrl ?? undefined)
    : (clip.videoUrl ?? clip.audioUrl ?? undefined);
  const hasMedia = Boolean(mediaSrc);

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
        const result = await verifyGuess(payload.mediaId, trimmed, suggestionId);
        setGuesses((prev) => [...prev, trimmed]);
        if (result.correct) {
          const matchTitle = result.match?.trim()
            ? result.match
            : payload.answer;
          setCanonicalTitle(matchTitle);
          setCompleted(true);
          setFeedback({
            type: "success",
            message: `Opening solved! ${matchTitle}`,
          });
        } else {
          setFeedback({
            type: "error",
            message: "No match yet. Try another guess!",
          });
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
    [completed, payload.answer, payload.mediaId, submitting, totalRounds],
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
      {hasMedia ? (
        shouldUseAudio ? (
          <div className="rounded-[1.8rem] border border-white/10 bg-gradient-to-br from-white/8 via-white/5 to-transparent p-5 backdrop-blur-xl">
            <audio
              controls
              preload="none"
              className="w-full rounded-2xl bg-black/40 px-4 py-3 text-sm text-neutral-200 shadow-inner shadow-brand-500/20"
            >
              <source src={mediaSrc} type={clipMimeType} />
              Your browser does not support the audio element.
            </audio>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-[1.8rem] border border-white/10 bg-gradient-to-br from-white/8 via-white/5 to-transparent p-5 backdrop-blur-xl">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_65%)] opacity-80"
              aria-hidden="true"
            />
            <video
              controls
              preload="none"
              playsInline
              className="relative z-[1] w-full rounded-2xl bg-black/40 text-sm text-neutral-200 shadow-inner shadow-brand-500/20"
            >
              <source src={mediaSrc} type={clipMimeType} />
              Your browser does not support the video element.
            </video>
          </div>
        )
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
          placeholder={
            completed ? `Opening solved! ${canonicalTitle}` : "Type your guess…"
          }
          ariaLabel={
            completed
              ? `Opening solved: ${canonicalTitle}`
              : "Guess the opening"
          }
          suggestionsLabel="Opening title suggestions"
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
        {completed && <NextPuzzleButton nextSlug={nextSlug} />}
      </div>
    </div>
  );
}
