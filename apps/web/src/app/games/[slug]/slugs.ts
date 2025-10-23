import { GameKey } from "../../../types/progress";

export interface PuzzleSlugDefinition {
  slug: string;
  title: string;
  gameKey?: GameKey;
  description?: string;
}

export const PUZZLE_SLUGS: PuzzleSlugDefinition[] = [
  { slug: "anidle", title: "Anidle", gameKey: "anidle" },
  { slug: "poster-zoomed", title: "Poster Zoomed", gameKey: "poster_zoomed" },
  { slug: "redacted-synopsis", title: "Redacted Synopsis", gameKey: "redacted_synopsis" },
  { slug: "guess-the-opening", title: "Guess the Opening", gameKey: "guess_the_opening" },
  {
    slug: "mystery-voice",
    title: "Mystery Voice",
    description: "Identify the character from a short voice clip.",
  },
  {
    slug: "emoji-synopsis",
    title: "Emoji Synopsis",
    description: "Decode an anime plot told entirely through emojis.",
  },
  {
    slug: "quote-quiz",
    title: "Quote Quiz",
    description: "Match iconic quotes to their series.",
  },
  {
    slug: "pixel-portrait",
    title: "Pixel Portrait",
    description: "Guess the character from a pixelated portrait.",
  },
];

export function findPuzzleSlug(slug: string): PuzzleSlugDefinition | undefined {
  return PUZZLE_SLUGS.find((entry) => entry.slug === slug);
}
