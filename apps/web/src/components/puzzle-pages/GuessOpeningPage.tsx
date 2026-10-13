"use client";

import GuessOpening, {
  GENRE_HINT_COST,
  VIDEO_HINT_COST,
  YEAR_HINT_COST,
} from "../GuessOpening";
import { ROUND_RULES, RoundGamePage } from "./RoundGamePage";
import type { GameProgress } from "../../types/progress";
import type { GuessOpeningGame } from "../../types/puzzles";

interface Props {
  payload: GuessOpeningGame;
  progress?: GameProgress;
  onProgressChange: (state: GameProgress) => void;
  nextSlug?: string | null;
}

const RULES = [
  ...ROUND_RULES,
  "Name the anime from a 30-second slice of its opening, audio only.",
  `Clues: buy the genres (−${GENRE_HINT_COST}) or release year (−${YEAR_HINT_COST}); after one of those you can unlock the video (−${VIDEO_HINT_COST}). The full opening plays on the results screen.`,
];

export function GuessOpeningPage({
  payload,
  progress,
  onProgressChange,
  nextSlug,
}: Props) {
  return (
    <RoundGamePage
      title="Guess the Opening"
      slug="guess-the-opening"
      roundCount={payload.rounds.length}
      progress={progress}
      onProgressChange={onProgressChange}
      rules={RULES}
    >
      {(handleProgressChange) => (
        <GuessOpening
          payload={payload.rounds}
          initialProgress={progress}
          onProgressChange={handleProgressChange}
          nextSlug={nextSlug}
        />
      )}
    </RoundGamePage>
  );
}
