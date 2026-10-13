import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { PuzzleSlugContent } from "../../../components/puzzle-pages";
import type { DailyPuzzleResponse } from "../../../types/puzzles";
import { findPuzzleSlug } from "./slugs";
import { findGameConfig } from "../../../config/games";
import { GameUnavailable } from "../../../components/GameUnavailable";
import { PuzzleProgressProvider } from "../../../hooks/usePuzzleProgress";

import { DailyRolloverNotice } from "../../../components/DailyRolloverNotice";

export const dynamic = "force-dynamic";

const API_BASE =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://localhost:8000";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** `?d=YYYY-MM-DD` opens that day's set (archive); otherwise today's. */
async function fetchDailyPuzzles(
  day?: string,
): Promise<DailyPuzzleResponse | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("guesssenpai_session");
    const headers = sessionCookie
      ? { cookie: `guesssenpai_session=${sessionCookie.value}` }
      : undefined;
    const query = day ? `?d=${encodeURIComponent(day)}` : "";
    const response = await fetch(`${API_BASE}/puzzles/today${query}`, {
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

export default async function PuzzleGamePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ d?: string | string[] }>;
}) {
  const { slug } = await params;
  const requested = (await searchParams)?.d;
  const day =
    typeof requested === "string" && DATE_PATTERN.test(requested)
      ? requested
      : undefined;
  const slugDefinition = findPuzzleSlug(slug);

  if (!slugDefinition) {
    // Known but unplayable modes (e.g. coming soon) get a friendly page;
    // anything else is a real 404.
    const known = findGameConfig(slug);
    if (known) {
      return <GameUnavailable title={known.title} />;
    }
    notFound();
  }

  const data = await fetchDailyPuzzles(day);
  const isArchiveDay =
    Boolean(data?.date) && data!.date < new Date().toISOString().slice(0, 10);

  const pageContent = (
    <div className="space-y-4">
      {data ? null : (
        <h1 className="font-display text-3xl font-bold tracking-tight text-paper">
          {slugDefinition.title}
        </h1>
      )}

      {data && !isArchiveDay ? <DailyRolloverNotice date={data.date} /> : null}
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
