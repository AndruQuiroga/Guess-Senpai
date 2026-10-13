import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { PuzzleSlugContent } from "../../../components/puzzle-pages";
import type { DailyPuzzleResponse } from "../../../types/puzzles";
import { findPuzzleSlug } from "./slugs";
import { PuzzleProgressProvider } from "../../../hooks/usePuzzleProgress";

import { DailyRolloverNotice } from "../../../components/DailyRolloverNotice";

export const dynamic = "force-dynamic";

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
    timeZone: "UTC",
  });
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

  const pageContent = (
    <div className="space-y-4">
      <header className="border-b border-[#484b4d] pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-display font-semibold tracking-tight">
              {slugDefinition.title}
            </h1>
            <p className="text-sm text-[#c1c2bd]">
              Part of GuessSenpai Daily
              {formattedDate ? ` — ${formattedDate}` : ""}
            </p>
          </div>
          <Link href="/" className="button shrink-0 whitespace-nowrap">
            ← Today
          </Link>
        </div>
      </header>

      {data && <DailyRolloverNotice date={data.date} />}
      <PuzzleSlugContent data={data} slug={slugDefinition} />
    </div>
  );

  if (!data?.date) {
    return pageContent;
  }

  return (
    <PuzzleProgressProvider
      date={data.date}
      puzzleId={data.puzzle_id}
      rulesVersion={data.rules_version}
    >
      {pageContent}
    </PuzzleProgressProvider>
  );
}
