"use client";

import Link from "next/link";
import { useMemo } from "react";

import type { SolutionPayload } from "../types/puzzles";

interface Props {
  solutions: SolutionPayload[];
}

export default function SolutionReveal({ solutions }: Props) {
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
    </section>
  );
}
