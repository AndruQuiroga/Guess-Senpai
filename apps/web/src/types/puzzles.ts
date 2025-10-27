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
  spec: RoundSpec[];
  answer: string;
  hints: AnidleHints;
}

export interface PosterZoomMeta {
  genres: string[];
  year?: number | null;
  format?: string | null;
}

export interface PosterCropStage {
  scale: number;
  offset_x: number;
  offset_y: number;
}

export interface PosterZoomGame {
  spec: RoundSpec[];
  answer: string;
  image?: string | null;
  meta: PosterZoomMeta;
  cropStages?: PosterCropStage[];
}

export interface RedactedSynopsisSegment {
  text: string;
  masked: boolean;
}

export interface RedactedSynopsisGame {
  spec: RoundSpec[];
  answer: string;
  text: string;
  segments: RedactedSynopsisSegment[];
  masked_word_indices: number[];
  masked_words: string[];
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

export interface CharacterSilhouetteGame {
  spec: CharacterSilhouetteRound[];
  answer: string;
  character: CharacterSilhouetteCharacter;
}

export interface OpeningClip {
  audioUrl?: string | null;
  videoUrl?: string | null;
  mimeType?: string | null;
  lengthSeconds?: number | null;
}

export interface GuessOpeningMeta {
  songTitle?: string | null;
  artist?: string | null;
  sequence?: number | null;
  season?: string | null;
  roundOrder?: number | null;
  roundTotal?: number | null;
}

export interface GuessOpeningGame {
  spec: RoundSpec[];
  answer: string;
  clip: OpeningClip;
  meta: GuessOpeningMeta;
}

export interface GuessOpeningRound {
  order: number;
  mediaId: number;
  puzzle: GuessOpeningGame;
  solution: SolutionPayload;
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
  rounds?: GuessOpeningRound[] | null;
}

export interface GamesPayload {
  anidle: AnidlePuzzleBundle;
  poster_zoomed: PosterZoomPuzzleBundle;
  redacted_synopsis: RedactedSynopsisPuzzleBundle;
  character_silhouette: CharacterSilhouettePuzzleBundle;
  guess_the_opening?: GuessOpeningPuzzleBundle | null;
  difficulty_level?: number | null;
}

export interface DailyPuzzleResponse {
  date: string;
  games: GamesPayload;
  guess_the_opening_enabled: boolean;
}
