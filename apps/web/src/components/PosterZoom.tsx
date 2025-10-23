"use client";

import { useEffect, useMemo, useState } from "react";

import { GameProgress } from "../hooks/usePuzzleProgress";
import { PosterZoomGame as PosterPayload } from "../types/puzzles";

interface Props {
  payload: PosterPayload;
  initialProgress?: GameProgress;
  onProgressChange(state: GameProgress): void;
  registerRoundController?: (fn: (round: number) => void) => void;
}

const TOTAL_ROUNDS = 3;

export default function PosterZoom({ payload, initialProgress, onProgressChange, registerRoundController }: Props) {
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
        >
          Mark Solved
        </button>
      </div>
      {completed && (
        <p className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          Poster solved: <span className="font-semibold text-emerald-100">{payload.answer}</span>
        </p>
      )}
    </div>
  );
}
