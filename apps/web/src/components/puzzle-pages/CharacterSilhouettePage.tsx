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
  "Each round shows four popular characters, each from a different anime. Fill in every character's name and anime, then press Check all.",
  `Each card is worth a quarter of the round: half for the name, half for the anime. Buy a clearer view of a card (−${SHARPEN_HINT_COST} from that card) if you need it.`,
  "Easy shows them as blurred full-colour zooms, Medium as black-and-white close-ups, Hard as full-colour mosaics.",
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
      title="Guess the Character"
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
