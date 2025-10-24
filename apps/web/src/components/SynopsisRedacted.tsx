"use client";

import { useEffect, useMemo, useState } from "react";

import { GameProgress } from "../hooks/usePuzzleProgress";
import { RedactedSynopsisGame as SynopsisPayload } from "../types/puzzles";

interface Props {
  payload: SynopsisPayload;
  initialProgress?: GameProgress;
  onProgressChange(state: GameProgress): void;
  registerRoundController?: (fn: (round: number) => void) => void;
}

const TOTAL_ROUNDS = 3;

export default function SynopsisRedacted({ payload, initialProgress, onProgressChange, registerRoundController }: Props) {
  const [round, setRound] = useState(initialProgress?.round ?? 1);
  const [guess, setGuess] = useState("");
  const [guesses, setGuesses] = useState<string[]>(initialProgress?.guesses ?? []);
  const [completed, setCompleted] = useState(initialProgress?.completed ?? false);

  const normalizedAnswer = useMemo(() => payload.answer.trim().toLowerCase(), [payload.answer]);

  useEffect(() => {
    if (!initialProgress) {
      setRound(1);
      setGuesses([]);
      setCompleted(false);
    } else {
      setRound(initialProgress.round ?? 1);
      setGuesses(initialProgress.guesses ?? []);
      setCompleted(initialProgress.completed ?? false);
    }
    setGuess("");
  }, [initialProgress, payload.answer, payload.text]);

  useEffect(() => {
    if (!registerRoundController) return;
    registerRoundController((targetRound) => {
      setRound(() => Math.max(1, Math.min(TOTAL_ROUNDS, targetRound)));
    });
  }, [registerRoundController]);

  const tokensToReveal = useMemo(() => {
    if (completed) {
      return payload.masked_tokens.length;
    }

    const activeSpecs = payload.spec.filter((spec) => spec.difficulty <= round);
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
    return maxTokens;
  }, [completed, payload.masked_tokens.length, payload.spec, round]);

  const revealedText = useMemo(() => {
    if (tokensToReveal <= 0) return payload.text;
    const replacements = payload.masked_tokens.slice(0, tokensToReveal);
    let index = 0;
    return payload.text.replace(/\[REDACTED\]/g, () => {
      const token = replacements[index];
      index += 1;
      return token ?? "[REDACTED]";
    });
  }, [completed, payload.masked_tokens, payload.text, tokensToReveal]);

  useEffect(() => {
    onProgressChange({ completed, round, guesses });
  }, [completed, round, guesses, onProgressChange]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = guess.trim();
    if (!value) return;
    setGuesses((prev) => [...prev, value]);
    if (value.toLowerCase() === normalizedAnswer) {
      setCompleted(true);
    } else {
      setRound((prev) => (prev >= TOTAL_ROUNDS ? TOTAL_ROUNDS : prev + 1));
    }
    setGuess("");
  };

  return (
    <div className="space-y-5">
      <div className="rounded-[1.8rem] border border-white/10 bg-white/5 p-5 text-base leading-relaxed text-neutral-100 shadow-inner shadow-black/10 whitespace-pre-wrap">
        {revealedText}
      </div>
      <div className="flex flex-wrap gap-2 text-xs uppercase tracking-wide text-brand-100/80">
        {tokensToReveal > 0 && (
          <span className="rounded-full border border-brand-400/30 bg-brand-500/10 px-3 py-1 font-semibold text-white/90">
            Unmasked tokens: {tokensToReveal}
          </span>
        )}
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-400/25 disabled:cursor-not-allowed disabled:opacity-60"
          placeholder={completed ? payload.answer : "Guess the anime…"}
          value={guess}
          onChange={(event) => setGuess(event.target.value)}
          disabled={completed}
          aria-label="Synopsis guess"
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-brand-500 via-purple-500 to-pink-500 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-glow transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={completed}
        >
          Submit
        </button>
      </form>
      {completed && (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          Correct! The anime is <span className="font-semibold text-emerald-100">{payload.answer}</span>.
        </div>
      )}
    </div>
  );
}
