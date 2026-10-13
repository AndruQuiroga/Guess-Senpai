"use client";

import type { GameProgress } from "../hooks/usePuzzleProgress";
import type { AnidleGame as AnidlePayload } from "../types/puzzles";
import { GuessGrid } from "./anidle/GuessGrid";
import { GuessInput } from "./anidle/GuessInput";
import { HintStrip } from "./anidle/HintStrip";
import { ResultCard } from "./anidle/ResultCard";
import type { AnidleEvaluationView } from "./anidle/tiles";
import { useAnidleGame } from "./anidle/useAnidleGame";

interface Props {
  mediaId: number;
  payload: AnidlePayload;
  initialProgress?: GameProgress;
  onProgressChange(state: GameProgress): void;
  registerRoundController?: (fn: (round: number) => void) => void;
  nextSlug?: string | null;
  accountDifficulty?: number;
}

/** Thin composition: input first, hints below it, then the result and grid. */
export default function Anidle({
  mediaId,
  payload,
  initialProgress,
  onProgressChange,
  registerRoundController,
  nextSlug,
}: Props) {
  const game = useAnidleGame({
    mediaId,
    payload,
    initialProgress,
    onProgressChange,
    registerRoundController,
  });
  const views = game.evaluations as (AnidleEvaluationView | null)[];
  const answerCover = views.find((entry) => entry?.correct)?.coverImage ?? null;

  return (
    <div className="space-y-5 text-paper">
      {!game.finished ? (
        <GuessInput
          value={game.guess}
          onValueChange={game.setGuess}
          fieldRef={game.guessFieldRef}
          submitting={game.submitting}
          onSubmit={game.handleSubmit}
          onFieldSubmit={game.handleFieldSubmit}
          showPrompt={game.attemptsUsed === 0}
          error={game.errorMessage}
        />
      ) : null}
      <HintStrip hints={game.hints} />
      {game.finished ? (
        <ResultCard
          solved={game.completed}
          answer={payload.answer}
          attempts={game.attemptsUsed}
          maxAttempts={game.maxAttempts}
          evaluations={game.evaluations}
          nextSlug={nextSlug}
          coverImage={answerCover}
        />
      ) : null}
      <GuessGrid
        evaluations={views}
        animateIndex={game.lastAddedIndex}
        hydrating={game.hydrating}
        hydrationProgress={game.hydrationProgress}
      />
    </div>
  );
}
