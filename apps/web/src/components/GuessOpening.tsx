"use client";

import { useEffect, useMemo, useState } from "react";

import { GameProgress } from "../hooks/usePuzzleProgress";
import { GuessOpeningGame as GuessOpeningPayload } from "../types/puzzles";

interface Props {
  payload: GuessOpeningPayload;
  initialProgress?: GameProgress;
  onProgressChange(state: GameProgress): void;
  registerRoundController?: (fn: (round: number) => void) => void;
}

const TOTAL_ROUNDS = 3;

export default function GuessOpening({ payload, initialProgress, onProgressChange, registerRoundController }: Props) {
  const [round, setRound] = useState(initialProgress?.round ?? 1);
  const [completed, setCompleted] = useState(initialProgress?.completed ?? false);

  useEffect(() => {
    if (!initialProgress) return;
    setRound(initialProgress.round ?? 1);
    setCompleted(initialProgress.completed ?? false);
  }, [initialProgress]);

  useEffect(() => {
    if (!registerRoundController) return;
    registerRoundController((targetRound) => {
      setRound(() => Math.max(1, Math.min(TOTAL_ROUNDS, targetRound)));
    });
  }, [registerRoundController]);

  useEffect(() => {
    onProgressChange({ completed, round, guesses: [] });
  }, [completed, round, onProgressChange]);

  const hints = useMemo(() => {
    const badges: string[] = [];
    payload.spec
      .filter((spec) => spec.difficulty <= round || completed)
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
        });
      });
    if (completed) {
      badges.push(`Answer: ${payload.answer}`);
    }
    return Array.from(new Set(badges));
  }, [payload, round, completed]);

  const audioSrc = payload.clip.audioUrl ?? payload.clip.videoUrl ?? "";

  return (
    <div className="space-y-5">
      {audioSrc ? (
        <div className="rounded-[1.8rem] border border-white/10 bg-gradient-to-br from-white/8 via-white/5 to-transparent p-5 backdrop-blur-xl">
          <audio
            controls
            preload="none"
            src={audioSrc}
            className="w-full rounded-2xl bg-black/40 px-4 py-3 text-sm text-neutral-200 shadow-inner shadow-brand-500/20"
          >
            Your browser does not support the audio element.
          </audio>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-neutral-300">
          No clip available for this title today.
        </div>
      )}
      <div className="flex flex-wrap gap-2 text-xs uppercase tracking-wide text-brand-100/80">
        {hints.map((hint) => (
          <span key={hint} className="rounded-full border border-white/10 bg-white/10 px-3 py-1 font-semibold text-white/90">
            {hint}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:border-brand-400/50 hover:text-brand-100 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => setRound((prev) => (prev >= TOTAL_ROUNDS ? TOTAL_ROUNDS : prev + 1))}
          disabled={completed || round === TOTAL_ROUNDS}
        >
          Reveal More
        </button>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-400 px-4 py-2 text-sm font-semibold text-emerald-950 shadow-glow transition hover:scale-[1.02]"
          onClick={() => setCompleted(true)}
          disabled={completed}
        >
          I Guessed It
        </button>
      </div>
      {completed && (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          Opening solved: <span className="font-semibold text-emerald-100">{payload.answer}</span>
        </div>
      )}
    </div>
  );
}
