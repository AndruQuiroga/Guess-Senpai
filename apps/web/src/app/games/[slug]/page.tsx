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

export default async function PuzzleGamePage({
  params,
}: {
  params: { slug: string };
}) {
  const slugDefinition = findPuzzleSlug(params.slug);

  if (!slugDefinition) {
    // Known but unplayable modes (e.g. coming soon) get a friendly page;
    // anything else is a real 404.
    const known = findGameConfig(params.slug);
    if (known) {
      return <GameUnavailable title={known.title} />;
    }
    notFound();
  }

  const data = await fetchDailyPuzzles();

  const pageContent = (
    <div className="space-y-4">
      {data ? null : (
        <h1 className="font-display text-3xl font-bold tracking-tight text-paper">
          {slugDefinition.title}
        </h1>
      )}

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
