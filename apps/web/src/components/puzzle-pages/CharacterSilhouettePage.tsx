"use client";

import CharacterSilhouette, { SHARPEN_HINT_COST } from "../CharacterSilhouette";
import { ROUND_RULES, RoundGamePage } from "./RoundGamePage";
import type { GameProgress } from "../../types/progress";
import type { CharacterSilhouetteGame } from "../../types/puzzles";

interface Props {
  mediaId: number;
  payload: CharacterSilhouetteGame;
  progress?: GameProgress;
  onProgressChange: (state: GameProgress) => void;
  nextSlug?: string | null;
}

const RULES = [
  ...ROUND_RULES,
  "Each round shows four shadowed characters, each from a different anime. Fill in every character's name and anime, then press Check all.",
  `Each card is worth a quarter of the round: half for the name, half for the anime. Sharpen a card (−${SHARPEN_HINT_COST} from that card) to see it more clearly.`,
];

export function CharacterSilhouettePage({
  mediaId,
  payload,
  progress,
  onProgressChange,
  nextSlug,
}: Props) {
  return (
    <RoundGamePage
      title="Character Silhouette"
      slug="character-silhouette"
      roundCount={
        payload.rounds.filter((round) => round.entries.length > 0).length
      }
      progress={progress}
      onProgressChange={onProgressChange}
      rules={RULES}
    >
      {(handleProgressChange) => (
        <CharacterSilhouette
          payload={payload}
          mediaId={mediaId}
          initialProgress={progress}
          onProgressChange={handleProgressChange}
          nextSlug={nextSlug}
        />
      )}
    </RoundGamePage>
  );
}
