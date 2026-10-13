"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

import { GameShell } from "../GameShell";
import { StakeBadge, StakeProvider } from "../rounds/RoundUI";
import { formatPoints } from "../rounds/scoring";
import type { GameProgress } from "../../types/progress";

interface Props {
  title: string;
  slug: string;
  roundCount: number;
  progress?: GameProgress;
  onProgressChange(state: GameProgress): void;
  rules?: string[];
  children(handleProgressChange: (state: GameProgress) => void): ReactNode;
}

/**
 * Shell for the Easy/Medium/Hard round games. The header shows the round in
 * play and the points so far from live progress. Rounds always start at
 * round 1; the profile difficulty preference no longer skips ahead.
 */
export function RoundGamePage({
  title,
  slug,
  roundCount,
  progress,
  onProgressChange,
  rules,
  children,
}: Props) {
  const [live, setLive] = useState(progress);
  useEffect(() => setLive(progress), [progress]);

  const handleProgressChange = useCallback(
    (state: GameProgress) => {
      setLive(state);
      onProgressChange(state);
    },
    [onProgressChange],
  );

  const rounds = live?.rounds ?? [];
  const played = rounds.filter(
    (round) => round.completed && round.result,
  ).length;
  const points = rounds.reduce((sum, round) => sum + (round.points ?? 0), 0);

  return (
    <StakeProvider>
      <GameShell
        title={title}
        slug={slug}
        rules={rules}
        status={
          <span className="flex items-center gap-2">
            <span>
              {played >= roundCount
                ? `Done · ${formatPoints(points)} pts`
                : `Round ${Math.min(roundCount, played + 1)} / ${roundCount}`}
            </span>
            <StakeBadge />
          </span>
        }
      >
        {children(handleProgressChange)}
      </GameShell>
    </StakeProvider>
  );
}

export const ROUND_RULES = [
  "Three rounds: Easy, Medium and Hard. Each is a different anime, from very popular to more obscure.",
  "Each round takes one answer, then shows the result and your points. Every round is worth up to 1,000 points.",
  "Hints are optional. Each shows its cost before you take it, and the cost comes off that round.",
];
