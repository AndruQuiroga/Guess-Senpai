export interface RoundSpec {
  difficulty: number;
  hints: string[];
}

export interface SynopsisHintLevel {
  ratio: number;
  text: string;
}

export interface AnidleHints {
  genres: string[];
  tags: string[];
  year?: number | null;
  episodes?: number | null;
  duration?: number | null;
  popularity?: number | null;
  average_score?: number | null;
  synopsis: SynopsisHintLevel[];
}

export interface AnidleGame {
  rules?: {
    version: "2";
    max_attempts: number;
    hint_after_incorrect: number[];
  } | null;
  spec: RoundSpec[];
  answer: string;
  hints: AnidleHints;
}

export interface PosterZoomMeta {
  seasonOptions?: number[];
  modification?: "black_white" | "mosaic" | "shuffled" | null;
  seasonNumber?: number | null;
  seriesTitles?: string[];
  genres: string[];
  year?: number | null;
  season?: string | null;
  format?: string | null;
}

export interface PosterCropStage {
  scale: number;
  offset_x: number;
  offset_y: number;
}

export interface PosterZoomRound {
  order: number;
  difficulty: number;
  mediaId: number;
  answer: string;
  meta: PosterZoomMeta;
  cropStages: PosterCropStage[];
  /** Rounds v3: answer card for the results screen. */
  solution?: SolutionPayload | null;
}

export interface PosterZoomGame {
  spec: RoundSpec[];
  rounds: PosterZoomRound[];
}

export interface RedactedSynopsisSegment {
  text: string;
  masked: boolean;
}

export interface RedactedSynopsisRound {
  order: number;
  difficulty: number;
  mediaId: number;
  answer: string;
  segments: RedactedSynopsisSegment[];
  /** Masked word indices in the order hints reveal them. */
  masked_word_indices: number[];
  solution: SolutionPayload;
}

export interface RedactedSynopsisGame {
  spec: RoundSpec[];
  answer: string;
  text: string;
  segments: RedactedSynopsisSegment[];
  masked_word_indices: number[];
  masked_words: string[];
  /** Rounds v3: Easy/Medium/Hard rounds, each a different anime. */
  rounds?: RedactedSynopsisRound[];
}

export interface CharacterSilhouetteRound {
  difficulty: number;
  label: string;
  filter: string;
  description?: string | null;
}

export interface CharacterSilhouetteCharacter {
  id: number;
  name: string;
  image: string;
  role?: string | null;
}

export interface CharacterGuessReveal {
  label: string;
  filter: string;
  description?: string | null;
}

export interface CharacterGuessEntry {
  character: CharacterSilhouetteCharacter;
  characterAnswer: string;
  characterAliases: string[];
  animeAnswer: string;
  animeAliases: string[];
  reveal: CharacterGuessReveal;
  /** Rounds v3: the anime this card belongs to (cards differ per round). */
  mediaId?: number | null;
  animeCover?: string | null;
}

export interface CharacterGuessRound {
  order: number;
  difficulty: number;
  entries: CharacterGuessEntry[];
}

export interface CharacterSilhouetteGame {
  spec: CharacterSilhouetteRound[];
  answer: string;
  character: CharacterSilhouetteCharacter;
  rounds: CharacterGuessRound[];
}

export interface OpeningClip {
  audioUrl?: string | null;
  videoUrl?: string | null;
  mimeType?: string | null;
  lengthSeconds?: number | null;
  /** Playable window in seconds; nothing outside it is exposed. */
  startSeconds?: number | null;
  endSeconds?: number | null;
}

export interface GuessOpeningMeta {
  seasonOptions?: number[];
  seasonNumber?: number | null;
  seriesTitles?: string[];
  songTitle?: string | null;
  artist?: string | null;
  sequence?: number | null;
  season?: string | null;
  /** Buyable clues (rounds v3). */
  genres?: string[];
  year?: number | null;
  roundOrder?: number | null;
  roundTotal?: number | null;
}

export interface GuessOpeningRound {
  order: number;
  difficulty?: number | null;
  mediaId: number;
  spec: RoundSpec[];
  answer: string;
  clip: OpeningClip;
  meta: GuessOpeningMeta;
  solution: SolutionPayload;
}

export interface GuessOpeningGame {
  rounds: GuessOpeningRound[];
}

export interface SolutionTitles {
  romaji?: string | null;
  english?: string | null;
  native?: string | null;
  userPreferred?: string | null;
}

export interface SolutionStreamingLink {
  site: string;
  url: string;
}

export interface SolutionPayload {
  titles: SolutionTitles;
  coverImage?: string | null;
  synopsis?: string | null;
  aniListUrl: string;
  streamingLinks: SolutionStreamingLink[];
}

export interface AnidlePuzzleBundle {
  mediaId: number;
  puzzle: AnidleGame;
  solution: SolutionPayload;
}

export interface PosterZoomPuzzleBundle {
  mediaId: number;
  puzzle: PosterZoomGame;
  solution: SolutionPayload;
}

export interface RedactedSynopsisPuzzleBundle {
  mediaId: number;
  puzzle: RedactedSynopsisGame;
  solution: SolutionPayload;
}

export interface CharacterSilhouettePuzzleBundle {
  mediaId: number;
  puzzle: CharacterSilhouetteGame;
  solution: SolutionPayload;
}

export interface GuessOpeningPuzzleBundle {
  mediaId: number;
  puzzle: GuessOpeningGame;
  solution: SolutionPayload;
}

export interface GamesPayload {
  anidle: AnidlePuzzleBundle;
  poster_zoomed: PosterZoomPuzzleBundle;
  poster_modified?: PosterZoomPuzzleBundle | null;
  redacted_synopsis: RedactedSynopsisPuzzleBundle;
  character_silhouette: CharacterSilhouettePuzzleBundle;
  guess_the_opening?: GuessOpeningPuzzleBundle | null;
  difficulty_level?: number | null;
}

export interface DailyPuzzleResponse {
  date: string;
  puzzle_id: string;
  rules_version: string;
  reset_at: string;
  available_modes: string[];
  mode_puzzle_ids: Record<string, string>;
  games: GamesPayload;
  guess_the_opening_enabled: boolean;
}
