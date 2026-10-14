"use client";

import PosterZoom from "../PosterZoom";
import { RoundGamePage } from "./RoundGamePage";
import type { GameProgress } from "../../types/progress";
import type { PosterZoomGame } from "../../types/puzzles";

export function PosterModifiedPage({
  payload,
  progress,
  onProgressChange,
  nextSlug,
}: {
  payload: PosterZoomGame;
  progress?: GameProgress;
  onProgressChange(state: GameProgress): void;
  nextSlug?: string | null;
}) {
  return (
    <RoundGamePage
      title="Poster Modified"
      slug="poster-modified"
      roundCount={payload.rounds.length}
      progress={progress}
      onProgressChange={onProgressChange}
      rules={[
        "Three different anime: Easy, Medium and Hard are based on popularity.",
        "One black-and-white, one mosaic and one shuffled-tile poster, in a different order each daily set.",
        "Anime title: 600 points. With the correct anime: a year one off earns 50, exact year 100, exact year and release season 200 total. Numbered season adds another 200 when known.",
        "Optional clues: a clearer image costs 150 (up to twice), genres cost 100. One answer per round; the original poster appears with the results.",
      ]}
    >
      {(handleProgressChange) => (
        <PosterZoom
          modified
          payload={payload}
          initialProgress={progress}
          onProgressChange={handleProgressChange}
          nextSlug={nextSlug}
        />
      )}
    </RoundGamePage>
  );
}
