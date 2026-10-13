"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { getPuzzleTitleFromSlug } from "../utils/puzzleTitles";

interface Props {
  nextSlug?: string | null;
  className?: string;
}

function buildClassName(base: string, extra?: string) {
  return extra ? `${base} ${extra}` : base;
}

export default function NextPuzzleButton({ nextSlug, className }: Props) {
  // Stay on the same archive day when playing through a past set.
  const day = useSearchParams()?.get("d");
  const query = day ? `?d=${encodeURIComponent(day)}` : "";
  const href = nextSlug ? `/games/${nextSlug}${query}` : "/games/daily";
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
