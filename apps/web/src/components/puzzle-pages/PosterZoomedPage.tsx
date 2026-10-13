"use client";

import PosterZoom, {
  GENRE_HINT_COST,
  POSTER_POINTS,
  ZOOM_HINT_COST,
} from "../PosterZoom";
import { ROUND_RULES, RoundGamePage } from "./RoundGamePage";
import type { GameProgress } from "../../types/progress";
import type { PosterZoomGame } from "../../types/puzzles";

interface Props {
  payload: PosterZoomGame;
  progress?: GameProgress;
  onProgressChange: (state: GameProgress) => void;
  nextSlug?: string | null;
}

const RULES = [
  ...ROUND_RULES,
  `Name the anime from a zoomed-in crop of its poster (${POSTER_POINTS.title} pts). Season (+${POSTER_POINTS.season}) and year (+${POSTER_POINTS.year}, half if off by one) are bonus points.`,
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
