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
    "button button-primary mt-3 w-full sm:w-auto",
    className,
  );

  return (
    <Link href={href} className={combinedClassName}>
      {label}
      <span aria-hidden>→</span>
    </Link>
  );
}
