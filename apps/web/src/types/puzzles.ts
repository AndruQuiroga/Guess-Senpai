export interface RoundSpec {
  difficulty: number;
  hints: string[];
}

export interface AnidleHints {
  genres: string[];
  year?: number | null;
  episodes?: number | null;
  duration?: number | null;
  popularity?: number | null;
  average_score?: number | null;
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

export interface PosterZoomGame {
  spec: RoundSpec[];
  answer: string;
  image?: string | null;
  meta: PosterZoomMeta;
}

export interface RedactedSynopsisGame {
  spec: RoundSpec[];
  answer: string;
  text: string;
  masked_tokens: string[];
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
}

export interface GuessOpeningGame {
  spec: RoundSpec[];
  answer: string;
  clip: OpeningClip;
  meta: GuessOpeningMeta;
}

export interface GamesPayload {
  anidle: AnidleGame;
  poster_zoomed: PosterZoomGame;
  redacted_synopsis: RedactedSynopsisGame;
  guess_the_opening?: GuessOpeningGame | null;
}

export interface DailyPuzzleResponse {
  date: string;
  mediaId: number;
  games: GamesPayload;
}
