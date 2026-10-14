"use client";

import PosterZoom, {
  GENRE_HINT_COST,
  POSTER_POINTS,
  ZOOM_HINT_COST,
} from "../PosterZoom";
import { RoundGamePage } from "./RoundGamePage";
import type { GameProgress } from "../../types/progress";
import type { PosterZoomGame } from "../../types/puzzles";

interface Props {
  payload: PosterZoomGame;
  progress?: GameProgress;
  onProgressChange: (state: GameProgress) => void;
  nextSlug?: string | null;
}

const RULES = [
  "Three rounds: Easy, Medium and Hard follow anime popularity. Each uses a different anime.",
  `Name the anime from its cropped poster (${POSTER_POINTS.title} pts). With the correct anime, a year one off earns 50, exact year 100, exact year and release season 200 total. Numbered season adds 200 when known. One answer per round.`,
  `Hints: zoom out (−${ZOOM_HINT_COST} each, twice) or show genres (−${GENRE_HINT_COST}). The full poster appears on the results screen.`,
];

export function PosterZoomedPage({
  payload,
  progress,
  onProgressChange,
  nextSlug,
}: Props) {
  return (
    <RoundGamePage
      title="Poster Zoomed"
      slug="poster-zoomed"
      roundCount={payload.rounds.length}
      progress={progress}
      onProgressChange={onProgressChange}
      rules={RULES}
    >
      {(handleProgressChange) => (
        <PosterZoom
          payload={payload}
          initialProgress={progress}
          onProgressChange={handleProgressChange}
          nextSlug={nextSlug}
        />
      )}
    </RoundGamePage>
  );
}
