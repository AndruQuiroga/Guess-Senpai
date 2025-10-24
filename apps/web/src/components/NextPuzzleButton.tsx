"use client";

import Link from "next/link";

import { getPuzzleTitleFromSlug } from "../utils/puzzleTitles";

interface Props {
  nextSlug?: string | null;
  className?: string;
}

function buildClassName(base: string, extra?: string) {
  return extra ? `${base} ${extra}` : base;
}

export default function NextPuzzleButton({ nextSlug, className }: Props) {
  const href = nextSlug ? `/games/${nextSlug}` : "/games/daily";
  const nextTitle = getPuzzleTitleFromSlug(nextSlug);
  const label = nextSlug
    ? `Play ${nextTitle ?? "the next game"}`
    : "Back to daily puzzles";

  const combinedClassName = buildClassName(
    "mt-3 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-500 via-brand-400 to-cyan-400 px-5 py-2 text-sm font-semibold uppercase tracking-wide text-white shadow-glow transition hover:scale-[1.02]",
    className,
  );

  return (
    <Link href={href} className={combinedClassName}>
      {label}
      <span aria-hidden>→</span>
    </Link>
  );
}
