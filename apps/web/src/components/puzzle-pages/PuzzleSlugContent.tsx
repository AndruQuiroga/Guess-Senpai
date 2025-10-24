"use client";

import { useMemo } from "react";

import { usePuzzleProgress } from "../../hooks/usePuzzleProgress";
import { PlaceholderPuzzlePage } from "./PlaceholderPuzzlePage";
import { AnidlePage } from "./AnidlePage";
import { PosterZoomedPage } from "./PosterZoomedPage";
import { RedactedSynopsisPage } from "./RedactedSynopsisPage";
import { GuessOpeningPage } from "./GuessOpeningPage";
import type { PuzzleSlugDefinition } from "../../app/games/[slug]/slugs";
import type {
  AnidleGame,
  DailyPuzzleResponse,
  GamesPayload,
  GuessOpeningGame,
  PosterZoomGame,
  RedactedSynopsisGame,
} from "../../types/puzzles";

interface Props {
  data: DailyPuzzleResponse | null;
  slug: PuzzleSlugDefinition;
}

export function PuzzleSlugContent({ data, slug }: Props) {
  const gameKey = slug.gameKey;

  const payload = useMemo<GamesPayload[keyof GamesPayload] | null>(() => {
    if (!data || !gameKey) return null;
    return data.games[gameKey as keyof GamesPayload] ?? null;
  }, [data, gameKey]);

  const { progress, recordGame } = usePuzzleProgress(data?.date ?? "");

  if (!data) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-surface-raised p-6 text-neutral-100 shadow-ambient backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />
        Couldn&apos;t load today&apos;s puzzles. Please refresh or try again later.
      </div>
    );
  }

  if (!gameKey) {
    return <PlaceholderPuzzlePage title={slug.title} slug={slug.slug} description={slug.description} />;
  }

  switch (gameKey) {
    case "anidle":
      if (!payload) {
        return <PlaceholderPuzzlePage title={slug.title} slug={slug.slug} description={slug.description} />;
      }
      return (
        <AnidlePage
          slug={slug.slug}
          payload={payload as AnidleGame}
          progress={progress.anidle}
          onProgressChange={(state) => recordGame("anidle", state)}
        />
      );
    case "poster_zoomed":
      if (!payload) {
        return <PlaceholderPuzzlePage title={slug.title} slug={slug.slug} description={slug.description} />;
      }
      return (
        <PosterZoomedPage
          slug={slug.slug}
          payload={payload as PosterZoomGame}
          progress={progress.poster_zoomed}
          onProgressChange={(state) => recordGame("poster_zoomed", state)}
        />
      );
    case "redacted_synopsis":
      if (!payload) {
        return <PlaceholderPuzzlePage title={slug.title} slug={slug.slug} description={slug.description} />;
      }
      return (
        <RedactedSynopsisPage
          slug={slug.slug}
          payload={payload as RedactedSynopsisGame}
          progress={progress.redacted_synopsis}
          onProgressChange={(state) => recordGame("redacted_synopsis", state)}
        />
      );
    case "guess_the_opening":
      if (!payload) {
        return <PlaceholderPuzzlePage title={slug.title} slug={slug.slug} description={slug.description} />;
      }
      return (
        <GuessOpeningPage
          slug={slug.slug}
          payload={payload as GuessOpeningGame}
          progress={progress.guess_the_opening}
          onProgressChange={(state) => recordGame("guess_the_opening", state)}
        />
      );
    default:
      return <PlaceholderPuzzlePage title={slug.title} slug={slug.slug} description={slug.description} />;
  }
}
