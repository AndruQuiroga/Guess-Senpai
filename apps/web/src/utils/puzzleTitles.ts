const PUZZLE_TITLE_MAP: Record<string, string> = {
  anidle: "Anidle",
  "poster-zoomed": "Poster Zoomed",
  "character-silhouette": "Character Silhouette",
  "redacted-synopsis": "Redacted Synopsis",
  "guess-the-opening": "Guess the Opening",
};

function titleize(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getPuzzleTitleFromSlug(slug?: string | null): string | null {
  if (!slug) return null;
  return PUZZLE_TITLE_MAP[slug] ?? titleize(slug);
}
