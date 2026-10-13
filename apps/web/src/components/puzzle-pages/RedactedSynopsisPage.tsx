"use client";

import { useMemo } from "react";

import SynopsisRedacted, {
  MAX_REVEAL_HINTS,
  REVEAL_HINT_COST,
  synopsisRounds,
} from "../SynopsisRedacted";
import { ROUND_RULES, RoundGamePage } from "./RoundGamePage";
import type { GameProgress } from "../../types/progress";
import type {
  RedactedSynopsisGame,
  SolutionPayload,
} from "../../types/puzzles";

interface Props {
  mediaId: number;
  payload: RedactedSynopsisGame;
  solution?: SolutionPayload | null;
  progress?: GameProgress;
  onProgressChange: (state: GameProgress) => void;
  nextSlug?: string | null;
}

const RULES = [
  ...ROUND_RULES,
  "Name the anime from its synopsis with most words blacked out.",
  `Hints: reveal some hidden words (−${REVEAL_HINT_COST} each, up to ${MAX_REVEAL_HINTS} times). Words from the title are never revealed.`,
];

export function RedactedSynopsisPage({
  mediaId,
  payload,
  solution,
  progress,
  onProgressChange,
  nextSlug,
}: Props) {
  const roundCount = useMemo(
    () => synopsisRounds(payload, mediaId, solution).length,
    [mediaId, payload, solution],
  );
  return (
    <RoundGamePage
      title="Redacted Synopsis"
      slug="redacted-synopsis"
      roundCount={roundCount}
      progress={progress}
      onProgressChange={onProgressChange}
      rules={RULES}
    >
      {(handleProgressChange) => (
        <SynopsisRedacted
          payload={payload}
          mediaId={mediaId}
          solution={solution}
          initialProgress={progress}
          onProgressChange={handleProgressChange}
          nextSlug={nextSlug}
        />
      )}
    </RoundGamePage>
  );
}
