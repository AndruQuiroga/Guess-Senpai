"use client";

import { useMemo } from "react";

import type { GameKey, GameProgress } from "../../types/progress";

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

  const progressHandlers = useMemo<Record<GameKey, (state: GameProgress) => void>>(
    () => ({
      anidle: (state) => recordGame("anidle", state),
      poster_zoomed: (state) => recordGame("poster_zoomed", state),
      redacted_synopsis: (state) => recordGame("redacted_synopsis", state),
      guess_the_opening: (state) => recordGame("guess_the_opening", state),
    }),
    [recordGame],
  );

  if (!data) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-surface-raised p-6 text-neutral-100 shadow-ambient backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />
        Couldn&apos;t load today&apos;s puzzles. Please refresh or try again
        later.
      </div>
    );
  }

  if (!gameKey) {
    return (
      <PlaceholderPuzzlePage
        title={slug.title}
        slug={slug.slug}
        description={slug.description}
      />
    );
  }

  switch (gameKey) {
    case "anidle":
      if (!payload) {
        return (
          <PlaceholderPuzzlePage
            title={slug.title}
            slug={slug.slug}
            description={slug.description}
          />
        );
      }
      return (
        <AnidlePage
          slug={slug.slug}
          payload={payload as AnidleGame}
          progress={progress.anidle}
          onProgressChange={progressHandlers.anidle}
        />
      );
    case "poster_zoomed":
      if (!payload) {
        return (
          <PlaceholderPuzzlePage
            title={slug.title}
            slug={slug.slug}
            description={slug.description}
          />
        );
      }
      return (
        <PosterZoomedPage
          slug={slug.slug}
          mediaId={data.mediaId}
          payload={payload as PosterZoomGame}
          progress={progress.poster_zoomed}
          onProgressChange={progressHandlers.poster_zoomed}
        />
      );
    case "redacted_synopsis":
      if (!payload) {
        return (
          <PlaceholderPuzzlePage
            title={slug.title}
            slug={slug.slug}
            description={slug.description}
          />
        );
      }
      return (
        <RedactedSynopsisPage
          slug={slug.slug}
          payload={payload as RedactedSynopsisGame}
          progress={progress.redacted_synopsis}
          onProgressChange={progressHandlers.redacted_synopsis}
        />
      );
    case "guess_the_opening":
      if (!payload) {
        return (
          <PlaceholderPuzzlePage
            title={slug.title}
            slug={slug.slug}
            description={slug.description}
          />
        );
      }
      return (
        <GuessOpeningPage
          slug={slug.slug}
          mediaId={data.mediaId}
          payload={payload as GuessOpeningGame}
          progress={progress.guess_the_opening}
          onProgressChange={progressHandlers.guess_the_opening}
        />
      );
    default:
      return (
        <PlaceholderPuzzlePage
          title={slug.title}
          slug={slug.slug}
          description={slug.description}
        />
      );
  }
}
