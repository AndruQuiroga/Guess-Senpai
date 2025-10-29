"use client";

import { useMemo } from "react";

import type { GameKey, GameProgress } from "../../types/progress";

import { usePuzzleProgress } from "../../hooks/usePuzzleProgress";
import { useUserPreferences } from "../../hooks/useUserPreferences";
import { PlaceholderPuzzlePage } from "./PlaceholderPuzzlePage";
import { AnidlePage } from "./AnidlePage";
import { CharacterSilhouettePage } from "./CharacterSilhouettePage";
import { PosterZoomedPage } from "./PosterZoomedPage";
import { RedactedSynopsisPage } from "./RedactedSynopsisPage";
import { GuessOpeningPage } from "./GuessOpeningPage";
import { PUZZLE_SLUGS, type PuzzleSlugDefinition } from "../../app/games/[slug]/slugs";
import type {
  AnidleGame,
  CharacterSilhouetteGame,
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

  const bundle = useMemo<GamesPayload[keyof GamesPayload] | null>(() => {
    if (!data || !gameKey) return null;
    return data.games[gameKey as keyof GamesPayload] ?? null;
  }, [data, gameKey]);

  const { progress, recordGame } = usePuzzleProgress(data?.date ?? "");
  const { difficultyLevel } = useUserPreferences();

  const availablePuzzles = useMemo(() => {
    if (!data) return [];
    return PUZZLE_SLUGS.filter((entry) => {
      if (!entry.gameKey) {
        return false;
      }
      if (
        entry.gameKey === "guess_the_opening" &&
        !data.guess_the_opening_enabled
      ) {
        return false;
      }
      const payload = data.games[entry.gameKey];
      return Boolean(payload);
    });
  }, [data]);

  const progressHandlers = useMemo<Record<GameKey, (state: GameProgress) => void>>(
    () => ({
      anidle: (state) => recordGame("anidle", state),
      poster_zoomed: (state) => recordGame("poster_zoomed", state),
      redacted_synopsis: (state) => recordGame("redacted_synopsis", state),
      character_silhouette: (state) => recordGame("character_silhouette", state),
      guess_the_opening: (state) => recordGame("guess_the_opening", state),
    }),
    [recordGame],
  );

  const nextSlug = useMemo(() => {
    for (const entry of availablePuzzles) {
      if (entry.slug === slug.slug) {
        continue;
      }
      const key = entry.gameKey;
      if (!key) {
        continue;
      }
      if (!progress[key]?.completed) {
        return entry.slug;
      }
    }
    return null;
  }, [availablePuzzles, progress, slug.slug]);

  if (!data) {
    return (
      <div className="relative flex min-h-[50vh] flex-col items-center justify-center gap-4 overflow-hidden rounded-3xl border border-white/10 bg-surface-raised p-6 text-center text-neutral-100 shadow-ambient backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />
        <p className="max-w-md text-sm text-neutral-200">
          Couldn&apos;t load today&apos;s puzzles. Please refresh or try again later.
        </p>
      </div>
    );
  }

  if (!gameKey) {
    return (
      <PlaceholderPuzzlePage
        title={slug.title}
        slug={slug.slug}
        description={slug.description}
        dailyProgress={progress}
      />
    );
  }

  switch (gameKey) {
    case "anidle":
      if (!bundle) {
        return (
          <PlaceholderPuzzlePage
            title={slug.title}
            slug={slug.slug}
            description={slug.description}
            dailyProgress={progress}
          />
        );
      }
      {
        const anidleBundle = bundle as { mediaId: number; puzzle: AnidleGame };
        return (
          <AnidlePage
            slug={slug.slug}
            mediaId={anidleBundle.mediaId}
            payload={anidleBundle.puzzle}
            progress={progress.anidle}
            dailyProgress={progress}
            accountDifficulty={difficultyLevel ?? undefined}
            difficultyHint={data.games.difficulty_level ?? undefined}
            onProgressChange={progressHandlers.anidle}
            nextSlug={nextSlug}
          />
        );
      }
    case "poster_zoomed":
      if (!bundle) {
        return (
          <PlaceholderPuzzlePage
            title={slug.title}
            slug={slug.slug}
            description={slug.description}
            dailyProgress={progress}
          />
        );
      }
      {
        const posterBundle = bundle as { mediaId: number; puzzle: PosterZoomGame };
        return (
          <PosterZoomedPage
            slug={slug.slug}
            mediaId={posterBundle.mediaId}
            payload={posterBundle.puzzle}
            progress={progress.poster_zoomed}
            dailyProgress={progress}
            accountDifficulty={difficultyLevel ?? undefined}
            difficultyHint={data.games.difficulty_level ?? undefined}
            onProgressChange={progressHandlers.poster_zoomed}
            nextSlug={nextSlug}
          />
        );
      }
    case "character_silhouette":
      if (!bundle) {
        return (
          <PlaceholderPuzzlePage
            title={slug.title}
            slug={slug.slug}
            description={slug.description}
            dailyProgress={progress}
          />
        );
      }
      {
        const silhouetteBundle = bundle as {
          mediaId: number;
          puzzle: CharacterSilhouetteGame;
        };
        return (
          <CharacterSilhouettePage
            slug={slug.slug}
            mediaId={silhouetteBundle.mediaId}
            payload={silhouetteBundle.puzzle}
            progress={progress.character_silhouette}
            dailyProgress={progress}
            accountDifficulty={difficultyLevel ?? undefined}
            difficultyHint={data.games.difficulty_level ?? undefined}
            onProgressChange={progressHandlers.character_silhouette}
            nextSlug={nextSlug}
          />
        );
      }
    case "redacted_synopsis":
      if (!bundle) {
        return (
          <PlaceholderPuzzlePage
            title={slug.title}
            slug={slug.slug}
            description={slug.description}
            dailyProgress={progress}
          />
        );
      }
      {
        const synopsisBundle = bundle as {
          mediaId: number;
          puzzle: RedactedSynopsisGame;
        };
        return (
          <RedactedSynopsisPage
            slug={slug.slug}
            mediaId={synopsisBundle.mediaId}
            payload={synopsisBundle.puzzle}
            progress={progress.redacted_synopsis}
            dailyProgress={progress}
            accountDifficulty={difficultyLevel ?? undefined}
            difficultyHint={data.games.difficulty_level ?? undefined}
            onProgressChange={progressHandlers.redacted_synopsis}
            nextSlug={nextSlug}
          />
        );
      }
    case "guess_the_opening":
      if (!bundle) {
        return (
          <PlaceholderPuzzlePage
            title={slug.title}
            slug={slug.slug}
            description={slug.description}
            dailyProgress={progress}
          />
        );
      }
      {
        const openingBundle = bundle as { mediaId: number; puzzle: GuessOpeningGame };
        return (
          <GuessOpeningPage
            slug={slug.slug}
            mediaId={openingBundle.mediaId}
            payload={openingBundle.puzzle}
            progress={progress.guess_the_opening}
            dailyProgress={progress}
            accountDifficulty={difficultyLevel ?? undefined}
            difficultyHint={data.games.difficulty_level ?? undefined}
            onProgressChange={progressHandlers.guess_the_opening}
            nextSlug={nextSlug}
          />
        );
      }
    default:
      return (
        <PlaceholderPuzzlePage
          title={slug.title}
          slug={slug.slug}
          description={slug.description}
          dailyProgress={progress}
        />
      );
  }
}
