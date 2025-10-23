import { GameDirectoryEntry, GAMES_DIRECTORY } from "../../../config/games";
import { GameKey } from "../../../types/progress";

export interface PuzzleSlugDefinition {
  slug: string;
  title: string;
  gameKey?: GameKey;
  description?: string;
}

function mapToPuzzleSlug(game: GameDirectoryEntry): PuzzleSlugDefinition {
  return {
    slug: game.slug,
    title: game.title,
    gameKey: game.gameKey,
    description: game.description,
  };
}

export const PUZZLE_SLUGS: PuzzleSlugDefinition[] = GAMES_DIRECTORY.filter((game) => game.playable).map(mapToPuzzleSlug);

export function findPuzzleSlug(slug: string): PuzzleSlugDefinition | undefined {
  return PUZZLE_SLUGS.find((entry) => entry.slug === slug);
}
