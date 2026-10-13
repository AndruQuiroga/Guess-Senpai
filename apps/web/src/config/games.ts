import { GameKey } from "../types/progress";

export type GamePreviewMedia =
  | {
      type: "image";
      src: string;
      alt: string;
    }
  | {
      type: "video";
      src: string;
      alt: string;
      loop?: boolean;
      muted?: boolean;
      requiresAutoplay?: boolean;
      autoPlay?: boolean;
    };

export interface GamePreviewPlaceholder {
  headline: string;
  description: string;
  icon?: string;
}

export interface GamePreviewContent {
  summary: string;
  rules: string[];
  media?: GamePreviewMedia;
  placeholder?: GamePreviewPlaceholder;
}

/**
 * How a mode becomes playable:
 * - "always": a normal daily mode, always in the user-facing lists.
 * - "daily": optional; playable only when today's availability payload says so
 *   (the single source of truth). Hidden from lists otherwise.
 * - "unreleased": not built yet. Never shown in user-facing lists and has no
 *   playable route; direct visits get a friendly "not available yet" page.
 * - "practice": always playable, but not part of the daily set. It has no
 *   gameKey, daily status, score or streak, and lives in PRACTICE_MODES (not
 *   GAMES_DIRECTORY) so daily lists never include it.
 */
export type GameRelease = "always" | "daily" | "unreleased" | "practice";

export interface GameDirectoryEntry {
  slug: string;
  title: string;
  tagline: string;
  accentColor: string;
  release: GameRelease;
  /** Resolved at runtime for "daily" modes; static for the others. */
  playable: boolean;
  /** Legacy flag; only true for "unreleased" modes. */
  comingSoon: boolean;
  gameKey?: GameKey;
  /** Route override for modes that do not live at /games/<slug>. */
  href?: string;
  description?: string;
  preview: GamePreviewContent;
}

export const GAMES_DIRECTORY: GameDirectoryEntry[] = [
  {
    slug: "anidle",
    title: "Anidle",
    tagline: "Identify the anime using metadata feedback and synopsis hints.",
    accentColor: "from-amber-400 via-orange-500 to-rose-500",
    release: "always",
    playable: true,
    comingSoon: false,
    gameKey: "anidle",
    description:
      "Identify the anime from metadata comparisons and progressively revealed synopsis clues.",
    preview: {
      summary:
        "Use metadata feedback from title guesses and unlock more synopsis clues as you progress.",
      rules: [
        "Submit an anime title to compare its metadata with the answer.",
        "Use higher/lower, matching, and partial-match feedback to narrow the possibilities.",
        "Twenty guesses; optional hints become available later in the game.",
      ],
      media: {
        type: "image",
        src: "/games/anidle.svg",
        alt: "Metadata comparison cells with match checks and higher or lower arrows.",
      },
      placeholder: {
        headline: "Metadata comparison",
        description:
          "Match checks and higher or lower clues help narrow down the anime.",
        icon: "🎧",
      },
    },
  },
  {
    slug: "poster-zoomed",
    title: "Poster Zoomed",
    tagline:
      "Sharpen the view across three rounds to name the anime and its release.",
    accentColor: "from-emerald-400 via-teal-400 to-sky-500",
    release: "always",
    playable: true,
    comingSoon: false,
    gameKey: "poster_zoomed",
    description:
      "Pinpoint the anime and when it debuted as its promotional poster gradually zooms out over three rounds.",
    preview: {
      summary:
        "Watch an iconic key visual slowly zoom out—each round adds release clues so you can lock in the anime and its debut.",
      rules: [
        "Three rounds (Easy, Medium, Hard), each a zoomed-in crop of a different poster.",
        "Name the anime, with bonus points for its season and year.",
        "Zoom out or show genres for a points cost; the full poster appears on the results screen.",
      ],
      media: {
        type: "image",
        src: "/games/poster-zoomed.svg",
        alt: "A poster crop within corner marks, opening toward the full image.",
      },
      placeholder: {
        headline: "Poster focus",
        description:
          "A shifting crop that unveils key art details frame by frame.",
        icon: "🖼️",
      },
    },
  },
  {
    slug: "character-silhouette",
    title: "Guess the Character",
    tagline: "Name every hidden character and the anime they come from.",
    accentColor: "from-purple-400 via-indigo-400 to-sky-500",
    release: "always",
    playable: true,
    comingSoon: false,
    gameKey: "character_silhouette",
    description:
      "Three rounds of four hidden characters, each from a different anime. Name them all, then check them at once.",
    preview: {
      summary:
        "Easy, Medium and Hard lineups of four hidden characters. Name each one and their anime, then check them all at once.",
      rules: [
        "Three rounds of four popular characters: black and white, close-up, then mosaic.",
        "Fill in every character's name and anime, then check them all at once.",
        "Sharpen a card for a points cost; each card shows its own result after checking.",
      ],
      media: {
        type: "image",
        src: "/games/character-silhouette.svg",
        alt: "A hidden character outline with a question mark: name the character and anime.",
      },
      placeholder: {
        headline: "Silhouette spotlight",
        description:
          "A hidden character outline awaiting its character and anime names.",
        icon: "🌌",
      },
    },
  },
  {
    slug: "redacted-synopsis",
    title: "Redacted Synopsis",
    tagline: "Fill in the blanks of a censored story summary.",
    accentColor: "from-fuchsia-500 via-purple-500 to-indigo-500",
    release: "always",
    playable: true,
    comingSoon: false,
    gameKey: "redacted_synopsis",
    description: "Reveal the title using a synopsis with missing keywords.",
    preview: {
      summary:
        "Decode a synopsis that censors critical names and phrases, piecing together the series from context clues.",
      rules: [
        "Three rounds (Easy, Medium, Hard), each a different anime's synopsis with most words blacked out.",
        "One answer per round; reveal a few words for a points cost.",
        "The full synopsis appears on the results screen.",
      ],
      media: {
        type: "image",
        src: "/games/redacted-synopsis.svg",
        alt: "A story page with words concealed by solid redaction bars.",
      },
      placeholder: {
        headline: "Blackout dossier",
        description:
          "Highlighted text lines with dramatic black bars covering keywords.",
        icon: "📝",
      },
    },
  },
  {
    slug: "guess-the-opening",
    title: "Guess the Opening",
    tagline: "Hear a few beats and lock in the correct anime opening.",
    accentColor: "from-blue-400 via-indigo-400 to-purple-500",
    release: "daily",
    playable: false,
    comingSoon: false,
    gameKey: "guess_the_opening",
    description:
      "Match a short music clip to the right series before time runs out.",
    preview: {
      summary:
        "An optional mode that is available when a playable clip set is returned.",
      rules: [
        "Three openings (Easy, Medium, Hard), each a 30-second audio slice from AnimeThemes.",
        "One answer per round; unlock the video or the artist for a points cost.",
        "The whole opening plays on the results screen.",
      ],
      media: {
        type: "image",
        src: "/games/guess-the-opening.svg",
        alt: "A play button and sound waveform for identifying an anime opening.",
      },
      placeholder: {
        headline: "Loop lab",
        description:
          "Pulsing equalizer bars teasing the next wave of OP snippets.",
        icon: "🎶",
      },
    },
  },
  {
    slug: "mystery-voice",
    title: "Mystery Voice",
    tagline: "Recognize the character from a fleeting voice line.",
    accentColor: "from-rose-400 via-amber-400 to-yellow-400",
    release: "unreleased",
    playable: false,
    comingSoon: true,
    description:
      "Pick the speaker after listening to a single in-character quote.",
    preview: {
      summary:
        "Clip detectives will love this—identify the character and series from a single in-character quote.",
      rules: [
        "Listen to the isolated voice line pulled from the anime.",
        "Pick the right character or series before the reveal is triggered.",
        "Submit your character and anime guesses to receive feedback.",
      ],
      media: {
        type: "image",
        src: "/games/mystery-voice.svg",
        alt: "A microphone with sound waves for identifying a mystery voice.",
      },
      placeholder: {
        headline: "Vocal vignette",
        description:
          "Stylized sound waves paired with a silhouetted character profile.",
        icon: "🎙️",
      },
    },
  },
  {
    slug: "emoji-synopsis",
    title: "Emoji Synopsis",
    tagline: "Decode a plot retold through nothing but emojis.",
    accentColor: "from-violet-400 via-purple-400 to-pink-500",
    release: "unreleased",
    playable: false,
    comingSoon: true,
    description: "Translate emoji clues into the anime they reference.",
    preview: {
      summary:
        "We retell entire plots using nothing but emoji strings—piece them together to name the series.",
      rules: [
        "Study the emoji sequence for characters, settings, and twists.",
        "Lock in the anime title that best fits the pictographic story.",
        "Submit the title that best matches the emoji clues.",
      ],
      media: {
        type: "image",
        src: "/games/emoji-synopsis.svg",
        alt: "Lightning, a home, and a hero face as symbolic story clues.",
      },
      placeholder: {
        headline: "Emoji storyboard",
        description:
          "Rows of expressive icons hinting at dramatic twists and tropes.",
        icon: "🧩",
      },
    },
  },
  {
    slug: "quote-quiz",
    title: "Quote Quiz",
    tagline: "Match iconic anime quotes with the right series.",
    accentColor: "from-cyan-400 via-emerald-400 to-lime-400",
    release: "unreleased",
    playable: false,
    comingSoon: true,
    description:
      "Test your memory of legendary lines from across anime history.",
    preview: {
      summary:
        "Put your quote library to the test by matching legendary anime lines to their source series.",
      rules: [
        "Read the highlighted quote pulled from the original script.",
        "Select the correct series or speaker from multiple options.",
        "Identify the anime or speaker from the displayed quote.",
      ],
      media: {
        type: "image",
        src: "/games/quote-quiz.svg",
        alt: "A speech card with quotation marks and a line to identify.",
      },
      placeholder: {
        headline: "Quote archive",
        description: "A dramatic typeset pull-quote waiting for attribution.",
        icon: "💬",
      },
    },
  },
];

export const UNLIMITED_ANIDLE_HREF = "/games/anidle/unlimited";

/** Practice modes, listed apart from the daily modes (nav, Today link). */
export const PRACTICE_MODES: GameDirectoryEntry[] = [
  {
    slug: "unlimited-anidle",
    title: "Unlimited Anidle",
    tagline: "Practice with a fresh random anime every round.",
    accentColor: "from-amber-400 via-orange-500 to-rose-500",
    release: "practice",
    playable: true,
    comingSoon: false,
    href: UNLIMITED_ANIDLE_HREF,
    description:
      "Anidle without the daily limit. Not counted toward your streak or daily score.",
    preview: {
      summary:
        "Same rules as the daily Anidle, with a new random puzzle whenever you finish one.",
      rules: [
        "Find one exact anime title in 20 accepted guesses.",
        "Nothing here counts toward your streak or daily score.",
      ],
    },
  },
];

/** Games a visitor may ever see (everything except unreleased modes). */
export function isUserFacingGame(game: GameDirectoryEntry): boolean {
  return game.release !== "unreleased";
}

/**
 * User-facing games that are playable right now. Daily-gated modes are
 * included only when availability resolved them as playable.
 */
export function getPlayableGames(
  games: GameDirectoryEntry[],
): GameDirectoryEntry[] {
  return games.filter((game) => isUserFacingGame(game) && game.playable);
}

export function findGameConfig(slug: string): GameDirectoryEntry | undefined {
  return GAMES_DIRECTORY.find((entry) => entry.slug === slug);
}

export interface RuntimeGameAvailability {
  guessTheOpeningEnabled: boolean;
}

export function resolveGameAvailability(
  game: GameDirectoryEntry,
  availability: RuntimeGameAvailability,
): GameDirectoryEntry {
  if (game.release !== "daily") {
    return game;
  }

  const playable = availability.guessTheOpeningEnabled;
  if (game.playable === playable && !game.comingSoon) {
    return game;
  }

  return { ...game, playable, comingSoon: false };
}

export function buildRuntimeGamesDirectory(
  availability: RuntimeGameAvailability,
): GameDirectoryEntry[] {
  return GAMES_DIRECTORY.map((game) =>
    resolveGameAvailability(game, availability),
  );
}
