"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { STREAK_MILESTONES, type StreakMilestone } from "../config/streak";
import type { StreakSnapshot } from "../types/streak";
import type { SolutionPayload } from "../types/puzzles";

interface Props {
  solutions: SolutionPayload[];
  streak?: StreakSnapshot;
}

const STREAK_MILESTONE_STORAGE_KEY = "guesssenpai:streak:milestones";

function readSeenMilestones(): number[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STREAK_MILESTONE_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((value): value is number => typeof value === "number");
  } catch {
    return [];
  }
}

function markMilestoneSeen(threshold: number) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const seen = new Set(readSeenMilestones());
    seen.add(threshold);
    window.localStorage.setItem(
      STREAK_MILESTONE_STORAGE_KEY,
      JSON.stringify(Array.from(seen.values()).sort((a, b) => a - b)),
    );
  } catch {
    /* noop */
  }
}

export default function SolutionReveal({ solutions, streak }: Props) {
  const entries = useMemo(() => {
    const seen = new Set<string>();
    return solutions.filter((solution) => {
      const key = solution.aniListUrl ?? "";
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [solutions]);

  const [activeMilestone, setActiveMilestone] = useState<StreakMilestone | null>(
    null,
  );

  useEffect(() => {
    if (!streak) {
      return;
    }
    const matched = STREAK_MILESTONES.find(
      (milestone) => milestone.threshold === streak.count,
    );
    if (!matched) {
      return;
    }
    const seenMilestones = readSeenMilestones();
    if (seenMilestones.includes(matched.threshold)) {
      return;
    }
    setActiveMilestone(matched);
    markMilestoneSeen(matched.threshold);
  }, [streak]);

  useEffect(() => {
    if (!activeMilestone) {
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveMilestone(null);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activeMilestone]);

  const handleCloseMilestone = useCallback(() => {
    setActiveMilestone(null);
  }, []);

  if (entries.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <span className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-200/80">
          All Solutions
        </span>
        <h2 className="text-2xl font-display font-semibold text-white">
          Revealed Anime
        </h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {entries.map((solution) => {
          const { titles, coverImage, synopsis, aniListUrl, streamingLinks } = solution;
          const primaryTitle =
            titles.userPreferred ??
            titles.english ??
            titles.romaji ??
            titles.native ??
            "Solution";

          const secondaryTitles = [
            { label: "English", value: titles.english },
            { label: "Romaji", value: titles.romaji },
            { label: "Native", value: titles.native },
          ].filter((item) => item.value && item.value !== primaryTitle);

          return (
            <article
              key={aniListUrl}
              className="relative overflow-hidden rounded-3xl border border-emerald-400/30 bg-surface-raised p-6 text-neutral-100 shadow-ambient backdrop-blur-2xl"
            >
              <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />
              <div className="flex flex-col gap-6 md:flex-row md:items-start">
                {coverImage && (
                  <div className="aspect-[3/4] w-full max-w-[180px] overflow-hidden rounded-2xl border border-white/10 shadow-inner md:w-auto">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={coverImage}
                      alt={primaryTitle}
                      className="h-full w-full object-cover object-center"
                      loading="lazy"
                    />
                  </div>
                )}
                <div className="flex-1 space-y-4">
                  <div>
                    <h3 className="text-xl font-display font-semibold text-white">
                      {primaryTitle}
                    </h3>
                    {secondaryTitles.length > 0 && (
                      <ul className="mt-2 space-y-1 text-sm text-neutral-300">
                        {secondaryTitles.map(({ label, value }) => (
                          <li key={label}>
                            <span className="font-medium text-neutral-200">{label}:</span> {value}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {synopsis && (
                    <p className="text-sm leading-relaxed text-neutral-200/90">{synopsis}</p>
                  )}

                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={aniListUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:scale-[1.02] hover:bg-emerald-500/30"
                    >
                      View on AniList
                    </Link>
                    {streamingLinks.map((link) => (
                      <Link
                        key={link.url}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white/90 transition hover:scale-[1.02] hover:bg-white/20"
                      >
                        {link.site}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {activeMilestone && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/75 px-4 py-6"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              handleCloseMilestone();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="streak-milestone-title"
            className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-emerald-400/40 bg-surface-raised/95 p-6 text-left shadow-ambient backdrop-blur-2xl sm:p-8"
          >
            <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />
            <button
              type="button"
              onClick={handleCloseMilestone}
              className="absolute right-4 top-4 rounded-full border border-white/20 bg-white/10 p-2 text-sm text-white/80 transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
              aria-label="Close milestone dialog"
            >
              ✕
            </button>
            <div className="space-y-6">
              <div className="space-y-3 text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200/80">
                  Streak milestone unlocked
                </p>
                <h3
                  id="streak-milestone-title"
                  className="text-2xl font-display font-semibold text-white sm:text-3xl"
                >
                  {activeMilestone.title}
                </h3>
                <p className="text-sm text-neutral-300">
                  {activeMilestone.rewardDescription}
                </p>
              </div>
              <div className="relative mx-auto flex h-36 w-36 items-center justify-center rounded-full border border-white/20 bg-neutral-900/60 shadow-[0_0_28px_rgba(16,185,129,0.35)]">
                <div
                  className={`h-32 w-32 rounded-full border-2 border-white/50 bg-gradient-to-br ${activeMilestone.frameGradient}`}
                  aria-hidden="true"
                />
              </div>
              <div className="space-y-3 text-center">
                <p className="text-lg font-semibold text-white">
                  {activeMilestone.rewardName}
                </p>
                <button
                  type="button"
                  onClick={handleCloseMilestone}
                  className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 px-5 py-2 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.02] hover:shadow-[0_0_22px_rgba(20,184,166,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
                >
                  Continue celebrating
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
