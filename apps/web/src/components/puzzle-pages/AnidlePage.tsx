"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Anidle from "../Anidle";
import { AttemptMeter } from "../anidle/AttemptMeter";
import { GameShell } from "../GameShell";
import type { DailyProgress, GameProgress } from "../../types/progress";
import { AnidleGame } from "../../types/puzzles";
import { isProgressExhausted } from "../../utils/gameAction";

interface Props {
  slug: string;
  mediaId: number;
  payload: AnidleGame;
  progress?: GameProgress;
  dailyProgress?: DailyProgress;
  accountDifficulty?: number;
  difficultyHint?: number;
  onProgressChange: (state: GameProgress) => void;
  nextSlug?: string | null;
}

const COMPARE_RULE =
  "Each guess is compared on year, score, popularity, genres, tags, studio and source. Green is a match, yellow is close, grey is wrong. Arrows point toward the answer.";

/** Rules shown behind the GameShell "?" button. */
function rulesCopy(rules: AnidleGame["rules"]): string[] {
  if (rules?.version === "2") {
    return [
      `Find one exact anime title in ${rules.max_attempts} accepted guesses.`,
      `Hints unlock after ${rules.hint_after_incorrect.join(", ")} wrong guesses: a partly redacted synopsis, or genres, then year, then tags when no synopsis exists.`,
      "Invalid titles, repeated anime and failed requests cost no guess.",
      COMPARE_RULE,
      "The final guess can still win.",
    ];
  }
  return [
    "Guess the anime title. Each accepted title is one attempt and a wrong guess advances the round (three rounds).",
    COMPARE_RULE,
    "The first synopsis hint appears after 10 wrong guesses, then another every 2.",
  ];
}

export function AnidlePage({
  mediaId,
  payload,
  progress,
  accountDifficulty,
  difficultyHint,
  onProgressChange,
  nextSlug,
}: Props) {
  const controller = useRef<((round: number) => void) | null>(null);
  const [controllerReady, setControllerReady] = useState(false);

  const rules = payload.rules?.version === "2" ? payload.rules : null;
  const totalRounds = useMemo(
    () => (rules ? rules.max_attempts : Math.max(payload.spec.length, 1)),
    [payload.spec.length, rules],
  );

  const clampDifficulty = useCallback(
    (value: number | undefined | null) => {
      if (typeof value !== "number" || Number.isNaN(value)) {
        return undefined;
      }
      const rounded = Math.round(value);
      return Math.max(1, Math.min(totalRounds, rounded));
    },
    [totalRounds],
  );

  const selectedDifficulty = clampDifficulty(accountDifficulty);
  const recommendedDifficulty = clampDifficulty(difficultyHint);
  const highlightDifficulty = selectedDifficulty ?? recommendedDifficulty ?? 1;
  // Rules v2 is one anime with a guess budget, so the header counts guesses.
  // Legacy rules keep the three-round header.
  const headerPosition = useCallback(
    (state?: GameProgress | null) => {
      if (!rules) return state?.round ?? highlightDifficulty;
      const accepted = state?.anidleHistory?.length ?? 0;
      const finished =
        Boolean(state?.completed) ||
        isProgressExhausted({
          completed: state?.completed,
          anidleHistory: state?.anidleHistory,
          attemptLimit: rules.max_attempts,
        });
      return Math.min(finished ? accepted : accepted + 1, rules.max_attempts);
    },
    [highlightDifficulty, rules],
  );
  const [live, setLive] = useState(progress);
  const displayRound = headerPosition(live);
  const used = live?.anidleHistory?.length ?? 0;
  const finished =
    Boolean(live?.completed) ||
    isProgressExhausted({
      completed: live?.completed,
      anidleHistory: live?.anidleHistory,
      attemptLimit: rules?.max_attempts,
    });

  useEffect(() => {
    controller.current = null;
    setControllerReady(false);
  }, [mediaId]);

  useEffect(() => {
    if (!controllerReady) return;
    if (progress?.completed) return;
    controller.current?.(highlightDifficulty);
  }, [controllerReady, highlightDifficulty, progress?.completed]);

  useEffect(() => {
    setLive(progress);
  }, [progress]);

  const handleProgressChange = useCallback(
    (state: GameProgress) => {
      setLive(state);
      onProgressChange(state);
    },
    [onProgressChange],
  );

  const registerController = useCallback((fn: (round: number) => void) => {
    controller.current = fn;
    setControllerReady(true);
  }, []);

  return (
    <div className="space-y-6">
      <GameShell
        title="Anidle"
        slug="anidle"
        rules={rulesCopy(payload.rules)}
        status={
          rules ? (
            <AttemptMeter
              used={used}
              max={rules.max_attempts}
              hintAfter={rules.hint_after_incorrect}
              position={displayRound}
              finished={finished}
            />
          ) : (
            <span>Round {displayRound}</span>
          )
        }
      >
        <Anidle
          mediaId={mediaId}
          payload={payload}
          initialProgress={progress}
          onProgressChange={handleProgressChange}
          registerRoundController={registerController}
          nextSlug={nextSlug}
          accountDifficulty={selectedDifficulty}
        />
      </GameShell>
    </div>
  );
}
