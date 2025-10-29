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

export interface GameDirectoryEntry {
  slug: string;
  title: string;
  tagline: string;
  accentColor: string;
  playable: boolean;
  comingSoon: boolean;
  gameKey?: GameKey;
  description?: string;
  preview: GamePreviewContent;
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
    preview: {
      summary:
        "Tackle three rounds of remixed anime openings and endings, locking in the show before the final beat drops.",
      rules: [
        "Listen to a short mashup of opening and ending themes for each round.",
        "Submit a guess after every listen—wrong answers unlock richer hints.",
        "Solve the playlist in three rounds to keep your streak alive.",
      ],
      media: {
        type: "image",
        src: "/games/anidle.svg",
        alt: "Stylized waveform cards highlighting a blended anime soundtrack.",
      },
      placeholder: {
        headline: "Audio sampler",
        description:
          "A waveform preview highlighting the shifting blend of iconic OP and ED tracks.",
        icon: "🎧",
      },
    },
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
    preview: {
      summary:
        "Watch an iconic key visual slowly zoom out and make the call before the full poster is revealed.",
      rules: [
        "Study the zoomed-in artwork and lock in a guess when inspiration strikes.",
        "Every incorrect answer widens the view with new visual context.",
        "Name the anime before the final reveal to score a perfect poster run.",
      ],
      media: {
        type: "image",
        src: "/games/poster-zoomed.svg",
        alt: "Layered poster frames expanding outward from a highlighted focal point.",
      },
      placeholder: {
        headline: "Poster focus",
        description: "A shifting crop that unveils key art details frame by frame.",
        icon: "🖼️",
      },
    },
  },
  {
    slug: "character-silhouette",
    title: "Character Silhouette",
    tagline: "Spot every member of the lineup as the lights turn up.",
    accentColor: "from-purple-400 via-indigo-400 to-sky-500",
    playable: true,
    comingSoon: false,
    gameKey: "character_silhouette",
    description:
      "Identify the anime and every featured character as the silhouettes sharpen across multiple reveal rounds.",
    preview: {
      summary:
        "Tackle three escalating rounds of silhouettes—four cards per round—locking in both the character and anime before the lights come up.",
      rules: [
        "Each round features four characters from the same anime—submit both the series and character name to clear a card.",
        "Incorrect guesses keep the round alive but you’ll need both answers to remove the filter.",
        "Clear all three rounds (twelve cards total) to complete the daily silhouette lineup.",
      ],
      media: {
        type: "image",
        src: "/games/character-silhouette.svg",
        alt: "Neon-lit character silhouette emerging from a dramatic spotlight.",
      },
      placeholder: {
        headline: "Silhouette spotlight",
        description: "A character outline emerging from neon rim lighting.",
        icon: "🌌",
      },
    },
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
    preview: {
      summary:
        "Decode a synopsis that censors critical names and phrases, piecing together the series from context clues.",
      rules: [
        "Review the redacted description and consider the surrounding hints.",
        "Guess the anime—incorrect answers restore a few missing terms.",
        "Fill in enough blanks to identify the series before the final reveal.",
      ],
      media: {
        type: "image",
        src: "/games/redacted-synopsis.svg",
        alt: "Classified dossier with highlighted lines and bold redaction bars.",
      },
      placeholder: {
        headline: "Blackout dossier",
        description: "Highlighted text lines with dramatic black bars covering keywords.",
        icon: "📝",
      },
    },
  },
  {
    slug: "guess-the-opening",
    title: "Guess the Opening",
    tagline: "Hear a few beats and lock in the correct anime opening.",
    accentColor: "from-blue-400 via-indigo-400 to-purple-500",
    playable: false,
    comingSoon: true,
    gameKey: "guess_the_opening",
    description: "Match a short music clip to the right series before time runs out.",
    preview: {
      summary:
        "A trio of anime openings drop every day—clear the full set to bank your Guess the Opening streak.",
      rules: [
        "Spin up each short clip sourced from AnimeThemes and lock in the correct series.",
        "Three openings per day—solve every clip to secure the daily win.",
        "Hints reveal metadata like season, artist, song title, and clip length as you advance.",
      ],
      media: {
        type: "image",
        src: "/games/guess-the-opening.svg",
        alt: "Colorful equalizer bars pulsing behind a glowing play button.",
      },
      placeholder: {
        headline: "Loop lab",
        description: "Pulsing equalizer bars teasing the next wave of OP snippets.",
        icon: "🎶",
      },
    },
  },
  {
    slug: "mystery-voice",
    title: "Mystery Voice",
    tagline: "Recognize the character from a fleeting voice line.",
    accentColor: "from-rose-400 via-amber-400 to-yellow-400",
    playable: false,
    comingSoon: true,
    description: "Pick the speaker after listening to a single in-character quote.",
    preview: {
      summary:
        "Clip detectives will love this—identify the character and series from a single in-character quote.",
      rules: [
        "Listen to the isolated voice line pulled from the anime.",
        "Pick the right character or series before the reveal is triggered.",
        "Rack up streak bonuses for consecutive perfect matches.",
      ],
      media: {
        type: "image",
        src: "/games/mystery-voice.svg",
        alt: "Retro microphone console surrounded by radiating vocal waveforms.",
      },
      placeholder: {
        headline: "Vocal vignette",
        description: "Stylized sound waves paired with a silhouetted character profile.",
        icon: "🎙️",
      },
    },
  },
  {
    slug: "emoji-synopsis",
    title: "Emoji Synopsis",
    tagline: "Decode a plot retold through nothing but emojis.",
    accentColor: "from-violet-400 via-purple-400 to-pink-500",
    playable: false,
    comingSoon: true,
    description: "Translate emoji clues into the anime they reference.",
    preview: {
      summary:
        "We retell entire plots using nothing but emoji strings—piece them together to name the series.",
      rules: [
        "Study the emoji sequence for characters, settings, and twists.",
        "Lock in the anime title that best fits the pictographic story.",
        "Earn bonus points for solving without requesting clarifying hints.",
      ],
      media: {
        type: "image",
        src: "/games/emoji-synopsis.svg",
        alt: "Collage of vibrant emojis arranged over a glassy card surface.",
      },
      placeholder: {
        headline: "Emoji storyboard",
        description: "Rows of expressive icons hinting at dramatic twists and tropes.",
        icon: "🧩",
      },
    },
  },
  {
    slug: "quote-quiz",
    title: "Quote Quiz",
    tagline: "Match iconic anime quotes with the right series.",
    accentColor: "from-cyan-400 via-emerald-400 to-lime-400",
    playable: false,
    comingSoon: true,
    description: "Test your memory of legendary lines from across anime history.",
    preview: {
      summary:
        "Put your quote library to the test by matching legendary anime lines to their source series.",
      rules: [
        "Read the highlighted quote pulled from the original script.",
        "Select the correct series or speaker from multiple options.",
        "Maintain accuracy streaks to climb the leaderboard when it launches.",
      ],
      media: {
        type: "image",
        src: "/games/quote-quiz.svg",
        alt: "Dual speech bubbles floating above a neon quote card.",
      },
      placeholder: {
        headline: "Quote archive",
        description: "A dramatic typeset pull-quote waiting for attribution.",
        icon: "💬",
      },
    },
  },
];

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
  if (game.slug !== "guess-the-opening") {
    return game;
  }

  const playable = availability.guessTheOpeningEnabled;
  const comingSoon = !playable;

  if (game.playable === playable && game.comingSoon === comingSoon) {
    return game;
  }

  return {
    ...game,
    playable,
    comingSoon,
  };
}

export function buildRuntimeGamesDirectory(
  availability: RuntimeGameAvailability,
): GameDirectoryEntry[] {
  return GAMES_DIRECTORY.map((game) => resolveGameAvailability(game, availability));
}
