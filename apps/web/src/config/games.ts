import { GameKey } from "../types/progress";

export interface GameDirectoryEntry {
  slug: string;
  title: string;
  tagline: string;
  accentColor: string;
  playable: boolean;
  comingSoon: boolean;
  gameKey?: GameKey;
  description?: string;
}

export const GAMES_DIRECTORY: GameDirectoryEntry[] = [
  {
    slug: "anidle",
    title: "Anidle",
    tagline: "Name the anime from remixed OP and ED track hints.",
    accentColor: "from-amber-400 via-orange-500 to-rose-500",
    playable: true,
    comingSoon: false,
    gameKey: "anidle",
    description: "Identify each series from a playlist of opening and ending themes.",
  },
  {
    slug: "poster-zoomed",
    title: "Poster Zoomed",
    tagline: "Sharpen the view and guess the anime key art in time.",
    accentColor: "from-emerald-400 via-teal-400 to-sky-500",
    playable: true,
    comingSoon: false,
    gameKey: "poster_zoomed",
    description: "Pinpoint the show as its promotional poster gradually zooms out.",
  },
  {
    slug: "redacted-synopsis",
    title: "Redacted Synopsis",
    tagline: "Fill in the blanks of a censored story summary.",
    accentColor: "from-fuchsia-500 via-purple-500 to-indigo-500",
    playable: true,
    comingSoon: false,
    gameKey: "redacted_synopsis",
    description: "Reveal the title using a synopsis with missing keywords.",
  },
  {
    slug: "guess-the-opening",
    title: "Guess the Opening",
    tagline: "Hear a few beats and lock in the correct anime opening.",
    accentColor: "from-blue-400 via-indigo-400 to-purple-500",
    playable: false,
    comingSoon: true,
    description: "Match a short music clip to the right series before time runs out.",
  },
  {
    slug: "mystery-voice",
    title: "Mystery Voice",
    tagline: "Recognize the character from a fleeting voice line.",
    accentColor: "from-rose-400 via-amber-400 to-yellow-400",
    playable: false,
    comingSoon: true,
    description: "Pick the speaker after listening to a single in-character quote.",
  },
  {
    slug: "emoji-synopsis",
    title: "Emoji Synopsis",
    tagline: "Decode a plot retold through nothing but emojis.",
    accentColor: "from-violet-400 via-purple-400 to-pink-500",
    playable: false,
    comingSoon: true,
    description: "Translate emoji clues into the anime they reference.",
  },
  {
    slug: "quote-quiz",
    title: "Quote Quiz",
    tagline: "Match iconic anime quotes with the right series.",
    accentColor: "from-cyan-400 via-emerald-400 to-lime-400",
    playable: false,
    comingSoon: true,
    description: "Test your memory of legendary lines from across anime history.",
  },
];

export function findGameConfig(slug: string): GameDirectoryEntry | undefined {
  return GAMES_DIRECTORY.find((entry) => entry.slug === slug);
}
