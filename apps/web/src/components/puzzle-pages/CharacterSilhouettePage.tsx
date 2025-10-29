"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import CharacterSilhouette from "../CharacterSilhouette";
import GameSwitcher from "../GameSwitcher";
import { GameShell } from "../GameShell";
import type { DailyProgress, GameProgress } from "../../types/progress";
import type { CharacterSilhouetteGame } from "../../types/puzzles";

interface Props {
  slug: string;
  mediaId: number;
  payload: CharacterSilhouetteGame;
  progress?: GameProgress;
  dailyProgress?: DailyProgress;
  onProgressChange: (state: GameProgress) => void;
  nextSlug?: string | null;
}

export function CharacterSilhouettePage({
  slug,
  mediaId,
  payload,
  progress,
  dailyProgress,
  onProgressChange,
  nextSlug,
}: Props) {
  const totalRounds = useMemo(
    () => Math.max(payload.rounds?.length ?? payload.spec.length ?? 1, 1),
    [payload.rounds?.length, payload.spec.length],
  );

  const clampRound = useCallback(
    (value: number | undefined | null) => {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return 1;
      }
      const normalized = Math.floor(value);
      return Math.max(1, Math.min(totalRounds, normalized));
    },
    [totalRounds],
  );

  const [displayRound, setDisplayRound] = useState(() => clampRound(progress?.round ?? 1));

  useEffect(() => {
    setDisplayRound(clampRound(progress?.round ?? 1));
  }, [clampRound, progress?.round]);

  const handleProgressChange = useCallback(
    (state: GameProgress) => {
      setDisplayRound(clampRound(state.round));
      onProgressChange(state);
    },
    [clampRound, onProgressChange],
  );

  return (
    <div className="space-y-6">
      <GameShell
        title="Character Silhouette"
        round={displayRound}
        totalRounds={totalRounds}
        actions={<GameSwitcher currentSlug={slug} progress={dailyProgress} />}
      >
        <CharacterSilhouette
          mediaId={mediaId}
          payload={payload}
          initialProgress={progress}
          onProgressChange={handleProgressChange}
          nextSlug={nextSlug}
        />
      </GameShell>
    </div>
  );
}
