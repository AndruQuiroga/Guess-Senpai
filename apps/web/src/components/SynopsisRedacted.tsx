"use client";

import type { ReactNode } from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { GameProgress } from "../hooks/usePuzzleProgress";
import { RedactedSynopsisGame as SynopsisPayload } from "../types/puzzles";
import { resolveHintRound } from "../utils/difficulty";
import { verifyGuess } from "../utils/verifyGuess";
import NextPuzzleButton from "./NextPuzzleButton";
import {
  TitleGuessField,
  type TitleGuessFieldHandle,
  type TitleGuessSelection,
} from "./games/TitleGuessField";

interface Props {
  mediaId: number;
  payload: SynopsisPayload;
  initialProgress?: GameProgress;
  onProgressChange(state: GameProgress): void;
  registerRoundController?: (fn: (round: number) => void) => void;
  nextSlug?: string | null;
  accountDifficulty?: number;
}

const TOTAL_ROUNDS = 3;

type FeedbackState =
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | null;

export default function SynopsisRedacted({
  mediaId,
  payload,
  initialProgress,
  onProgressChange,
  registerRoundController,
  nextSlug,
  accountDifficulty,
}: Props) {
  const [round, setRound] = useState(initialProgress?.round ?? 1);
  const [guess, setGuess] = useState("");
  const [guesses, setGuesses] = useState<string[]>(
    initialProgress?.guesses ?? [],
  );
  const [completed, setCompleted] = useState(
    initialProgress?.completed ?? false,
  );
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const guessFieldRef = useRef<TitleGuessFieldHandle | null>(null);

  const normalizedAnswer = useMemo(
    () => payload.answer.trim().toLowerCase(),
    [payload.answer],
  );

  useEffect(() => {
    if (!initialProgress) {
      setRound(1);
      setGuesses([]);
      setCompleted(false);
      setFeedback(null);
    } else {
      setRound(initialProgress.round ?? 1);
      setGuesses(initialProgress.guesses ?? []);
      setCompleted(initialProgress.completed ?? false);
      if (initialProgress.completed) {
        setFeedback({
          type: "success",
          message: `Correct! The anime is ${payload.answer}`,
        });
      } else {
        setFeedback(null);
      }
    }
    setGuess("");
  }, [initialProgress, payload.answer, payload.text, payload.segments]);

  useEffect(() => {
    if (!registerRoundController) return;
    registerRoundController((targetRound) => {
      setRound(() => Math.max(1, Math.min(TOTAL_ROUNDS, targetRound)));
    });
  }, [registerRoundController]);

  const hintRound = useMemo(
    () =>
      completed
        ? TOTAL_ROUNDS
        : resolveHintRound(round, TOTAL_ROUNDS, accountDifficulty),
    [accountDifficulty, completed, round],
  );

  const wordsToReveal = useMemo(() => {
    const totalMasked = (payload.masked_word_indices ?? []).length;
    if (completed) {
      return totalMasked;
    }

    const activeSpecs = payload.spec.filter(
      (spec) => spec.difficulty <= hintRound,
    );
    let maxTokens = 0;
    activeSpecs.forEach((spec) => {
      spec.hints.forEach((hint) => {
        if (hint.startsWith("unmask:")) {
          const value = Number.parseInt(hint.split(":")[1], 10);
          if (!Number.isNaN(value)) {
            maxTokens = Math.max(maxTokens, value);
          }
        }
      });
    });
    return Math.min(maxTokens, totalMasked);
  }, [completed, hintRound, payload.masked_word_indices, payload.spec]);

  const revealedWordCount = useMemo(() => {
    if (completed) {
      return (payload.masked_word_indices ?? []).length;
    }
    return wordsToReveal;
  }, [completed, payload.masked_word_indices, wordsToReveal]);

  const renderedSynopsis = useMemo<ReactNode>(() => {
    const segments = payload.segments;
    if (!segments || segments.length === 0) {
      return <span className="whitespace-pre-wrap">{payload.text}</span>;
    }

    const order = payload.masked_word_indices ?? [];
    const revealCount = completed ? order.length : wordsToReveal;
    const revealSet = new Set(order.slice(0, revealCount));

    return segments.map((segment, index) => {
      const isMasked = segment.masked && !revealSet.has(index);
      if (isMasked) {
        return (
          <span
            key={`segment-${index}`}
            className="relative inline-flex align-baseline"
          >
            <span className="sr-only">Masked word</span>
            <span
              aria-hidden
              className="inline-flex select-none items-center rounded-sm bg-black px-1 py-0.5 text-sm font-semibold leading-tight text-transparent shadow-sm"
            >
              {segment.text}
            </span>
          </span>
        );
      }

      return (
        <span key={`segment-${index}`} className="whitespace-pre-wrap">
          {segment.text}
        </span>
      );
    });
  }, [
    completed,
    payload.masked_word_indices,
    payload.segments,
    payload.text,
    wordsToReveal,
  ]);

  useEffect(() => {
    onProgressChange({ completed, round, guesses });
  }, [completed, round, guesses, onProgressChange]);

  const attemptGuess = useCallback(
    async ({ value, suggestionId }: TitleGuessSelection) => {
      if (completed) return;
      const trimmed = value.trim();
      if (!trimmed) {
        setFeedback({
          type: "error",
          message: "Enter a guess before submitting.",
        });
        return;
      }

      setFeedback(null);
      try {
        const result = await verifyGuess(mediaId, trimmed, suggestionId);
        setGuesses((prev) => [...prev, trimmed]);
        if (result.correct) {
          setCompleted(true);
          setFeedback({
            type: "success",
            message: `Correct! The anime is ${payload.answer}`,
          });
        } else {
          setRound((prev) => (prev >= TOTAL_ROUNDS ? TOTAL_ROUNDS : prev + 1));
          setFeedback({
            type: "error",
            message: "Not quite. Keep trying!",
          });
        }
      } catch (error) {
        setGuesses((prev) => [...prev, trimmed]);
        if (trimmed.toLowerCase() === normalizedAnswer) {
          setCompleted(true);
          setFeedback({
            type: "success",
            message: `Correct! The anime is ${payload.answer}`,
          });
        } else {
          setRound((prev) => (prev >= TOTAL_ROUNDS ? TOTAL_ROUNDS : prev + 1));
          const message =
            error instanceof Error
              ? error.message
              : "Unable to verify your guess. Please try again.";
          setFeedback({
            type: "error",
            message,
          });
        }
      } finally {
        setGuess("");
      }
    },
    [completed, mediaId, normalizedAnswer, payload.answer],
  );

  const handleFieldSubmit = useCallback(
    (selection: TitleGuessSelection) => {
      void attemptGuess(selection);
    },
    [attemptGuess],
  );

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (completed) return;
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
    [attemptGuess, completed],
  );

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-[#686b6d] bg-[#2c2f31] p-5 text-base leading-relaxed text-[#f4f0e7]   whitespace-pre-wrap">
        {renderedSynopsis}
      </div>
      <div className="flex flex-wrap gap-2 text-sm uppercase tracking-wide text-[#c1c2bd]">
        {revealedWordCount > 0 && (
          <span className="rounded-full border border-[#686b6d] bg-[#2c2f31] px-3 py-1 font-semibold text-[#f4f0e7]">
            Revealed words: {revealedWordCount}
          </span>
        )}
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <TitleGuessField
          ref={guessFieldRef}
          className="w-full"
          value={guess}
          onValueChange={setGuess}
          onSubmit={handleFieldSubmit}
          disabled={completed}
          placeholder={completed ? payload.answer : "Guess the anime…"}
          ariaLabel="Synopsis guess"
          suggestionsLabel="Synopsis title suggestions"
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-lg bg-[#ff7658] !text-[#27110b] px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white  transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={completed}
        >
          Submit
        </button>
      </form>
      <div className="space-y-3 text-sm text-[#c1c2bd]" aria-live="polite">
        {guesses.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm uppercase tracking-[0.2em] text-[#c1c2bd]">
            Attempts
            {guesses.map((value, index) => (
              <span
                key={`${value}-${index}`}
                className="rounded-full border border-[#686b6d] bg-[#2c2f31] px-3 py-1 text-sm text-[#c1c2bd]"
              >
                {value}
              </span>
            ))}
          </div>
        )}
        {feedback?.type === "error" && (
          <div className="rounded-lg border border-[#c0566a] bg-[#40242a] px-4 py-3 text-sm text-rose-200">
            {feedback.message}
          </div>
        )}
        {feedback?.type === "success" && (
          <div className="rounded-lg border border-[#3f8a5f] bg-[#1f3a2c] px-4 py-3 text-sm text-emerald-200">
            {feedback.message}
          </div>
        )}
        {completed && <NextPuzzleButton nextSlug={nextSlug} />}
      </div>
    </div>
  );
}
