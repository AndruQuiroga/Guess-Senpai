"use client";

import { useMemo } from "react";

import type { GameKey, GameProgress } from "../../types/progress";

import { usePuzzleProgress } from "../../hooks/usePuzzleProgress";
import { useAccount } from "../../hooks/useAccount";
import { useUserPreferences } from "../../hooks/useUserPreferences";
import { PlaceholderPuzzlePage } from "./PlaceholderPuzzlePage";
import { AnidlePage } from "./AnidlePage";
import { CharacterSilhouettePage } from "./CharacterSilhouettePage";
import { PosterZoomedPage } from "./PosterZoomedPage";
import { RedactedSynopsisPage } from "./RedactedSynopsisPage";
import { GuessOpeningPage } from "./GuessOpeningPage";
import {
  PUZZLE_SLUGS,
  type PuzzleSlugDefinition,
} from "../../app/games/[slug]/slugs";
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
  const { account } = useAccount();

  const bundle = useMemo<GamesPayload[keyof GamesPayload] | null>(() => {
    if (!data || !gameKey) return null;
    return data.games[gameKey as keyof GamesPayload] ?? null;
  }, [data, gameKey]);

  const { progress, recordGame } = usePuzzleProgress(data?.date ?? "");
  const { difficultyLevel } = useUserPreferences({
    authenticated: account.authenticated,
  });

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

  const progressHandlers = useMemo<
    Record<GameKey, (state: GameProgress) => void>
  >(
    () => ({
      anidle: (state) => recordGame("anidle", state),
      poster_zoomed: (state) => recordGame("poster_zoomed", state),
      redacted_synopsis: (state) => recordGame("redacted_synopsis", state),
      character_silhouette: (state) =>
        recordGame("character_silhouette", state),
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
      <div className="panel flex min-h-[40vh] flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="max-w-md text-sm text-muted">
          Couldn&apos;t load today&apos;s puzzles. Your saved progress is kept.
        </p>
        <button
          type="button"
          className="button button-primary"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!gameKey) {
    return <PlaceholderPuzzlePage title={slug.title} />;
  }

  switch (gameKey) {
    case "anidle":
      if (!bundle) {
        return <PlaceholderPuzzlePage title={slug.title} />;
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
        return <PlaceholderPuzzlePage title={slug.title} />;
      }
      {
        const posterBundle = bundle as {
          mediaId: number;
          puzzle: PosterZoomGame;
        };
        return (
          <PosterZoomedPage
            payload={posterBundle.puzzle}
            progress={progress.poster_zoomed}
            accountDifficulty={difficultyLevel ?? undefined}
            difficultyHint={data.games.difficulty_level ?? undefined}
            onProgressChange={progressHandlers.poster_zoomed}
            nextSlug={nextSlug}
          />
        );
      }
    case "character_silhouette":
      if (!bundle) {
        return <PlaceholderPuzzlePage title={slug.title} />;
      }
      {
        const silhouetteBundle = bundle as {
          mediaId: number;
          puzzle: CharacterSilhouetteGame;
        };
        return (
          <CharacterSilhouettePage
            mediaId={silhouetteBundle.mediaId}
            payload={silhouetteBundle.puzzle}
            progress={progress.character_silhouette}
            accountDifficulty={difficultyLevel ?? undefined}
            difficultyHint={data.games.difficulty_level ?? undefined}
            onProgressChange={progressHandlers.character_silhouette}
            nextSlug={nextSlug}
          />
        );
      }
    case "redacted_synopsis":
      if (!bundle) {
        return <PlaceholderPuzzlePage title={slug.title} />;
      }
      {
        const synopsisBundle = bundle as {
          mediaId: number;
          puzzle: RedactedSynopsisGame;
        };
        return (
          <RedactedSynopsisPage
            mediaId={synopsisBundle.mediaId}
            payload={synopsisBundle.puzzle}
            progress={progress.redacted_synopsis}
            accountDifficulty={difficultyLevel ?? undefined}
            difficultyHint={data.games.difficulty_level ?? undefined}
            onProgressChange={progressHandlers.redacted_synopsis}
            nextSlug={nextSlug}
          />
        );
      }
    case "guess_the_opening":
      if (!bundle) {
        return <PlaceholderPuzzlePage title={slug.title} />;
      }
      {
        const openingBundle = bundle as {
          mediaId: number;
          puzzle: GuessOpeningGame;
        };
        return (
          <GuessOpeningPage
            mediaId={openingBundle.mediaId}
            payload={openingBundle.puzzle}
            progress={progress.guess_the_opening}
            accountDifficulty={difficultyLevel ?? undefined}
            difficultyHint={data.games.difficulty_level ?? undefined}
            onProgressChange={progressHandlers.guess_the_opening}
            nextSlug={nextSlug}
          />
        );
      }
    default:
      return <PlaceholderPuzzlePage title={slug.title} />;
  }
}
