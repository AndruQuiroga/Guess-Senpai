import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { GameSwitcher } from "../../../components/GameSwitcher";
import { PuzzleSlugContent } from "../../../components/puzzle-pages";
import type { DailyPuzzleResponse } from "../../../types/puzzles";
import { findPuzzleSlug, PUZZLE_SLUGS } from "./slugs";

const API_BASE =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://localhost:8000";

async function fetchDailyPuzzles(): Promise<DailyPuzzleResponse | null> {
  try {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get("guesssenpai_session");
    const headers = sessionCookie
      ? { cookie: `guesssenpai_session=${sessionCookie.value}` }
      : undefined;
    const response = await fetch(`${API_BASE}/puzzles/today`, {
      cache: "no-store",
      headers,
    });
    if (!response.ok) {
      console.error("Failed to fetch puzzles", await response.text());
      return null;
    }
    return (await response.json()) as DailyPuzzleResponse;
  } catch (error) {
    console.error("Error fetching puzzles", error);
    return null;
  }
}

function formatDate(value: string) {
  const [year, month, day] = value
    .split("-")
    .map((part) => Number.parseInt(part, 10));
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, day));
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function generateStaticParams(): { slug: string }[] {
  return PUZZLE_SLUGS.map(({ slug }) => ({ slug }));
}

export default async function PuzzleGamePage({
  params,
}: {
  params: { slug: string };
}) {
  const slugDefinition = findPuzzleSlug(params.slug);

  if (!slugDefinition) {
    notFound();
  }

  const data = await fetchDailyPuzzles();
  const formattedDate = data ? formatDate(data.date) : null;

  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-surface-raised p-6 shadow-ambient backdrop-blur-2xl">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-brand-400/60 to-transparent" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-display font-semibold tracking-tight text-white drop-shadow-[0_0_12px_rgba(59,130,246,0.35)]">
              {slugDefinition.title}
            </h1>
            <p className="text-sm text-neutral-300">
              Part of GuessSenpai Daily
              {formattedDate ? ` — ${formattedDate}` : ""}
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <GameSwitcher currentSlug={slugDefinition.slug} />
            <Link
              href="/games/daily"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-sm font-medium text-white/90 backdrop-blur-sm transition hover:bg-white/20"
            >
              ← Back to Daily
            </Link>
          </div>
        </div>
      </header>

      <PuzzleSlugContent data={data} slug={slugDefinition} />
    </div>
  );
}
