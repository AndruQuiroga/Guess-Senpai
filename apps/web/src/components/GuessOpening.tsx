"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";

import type { GameProgress } from "../types/progress";
import type { GuessOpeningRound } from "../types/puzzles";
import { verifyGuess } from "../utils/verifyGuess";
import { OpeningPlayer } from "./games/OpeningPlayer";
import {
  TitleGuessField,
  type TitleGuessFieldHandle,
} from "./games/TitleGuessField";
import {
  GameSummary,
  HintButton,
  LegacyFinished,
  RoundResult,
  RoundTabs,
} from "./rounds/RoundUI";
import {
  buildOutcome,
  difficultyLabel,
  line,
  ROUND_POINTS,
} from "./rounds/scoring";
import { useRoundGame, type RoundGameState } from "./rounds/useRoundGame";

export const VIDEO_HINT_COST = 300;
export const ARTIST_HINT_COST = 150;

interface Props {
  payload: GuessOpeningRound[];
  initialProgress?: GameProgress;
  onProgressChange(state: GameProgress): void;
  nextSlug?: string | null;
}

export default function GuessOpening({
  payload,
  initialProgress,
  onProgressChange,
  nextSlug,
}: Props) {
  const game = useRoundGame({
    roundCount: payload.length,
    initialProgress,
    onProgressChange,
    puzzleKey: payload.map((round) => round.mediaId).join(":"),
  });
  const tabs = payload.map((round) => ({
    label: difficultyLabel(round.difficulty, round.order),
  }));

  if (payload.length === 0) {
    return (
      <p className="text-muted">
        Unable to load Guess the Opening right now. Please try again later.
      </p>
    );
  }
  if (game.legacyFinished) return <LegacyFinished nextSlug={nextSlug} />;

  return (
    <div className="space-y-5">
      <RoundTabs
        rounds={tabs}
        records={game.records}
        view={game.view}
        canView={game.canView}
        onSelect={game.goTo}
      />
      {game.view >= payload.length ? (
        <GameSummary
          title="Guess the Opening"
          nextSlug={nextSlug}
          rows={payload.map((round, index) => ({
            label: `Round ${index + 1} · ${tabs[index].label}`,
            answer: round.answer,
            coverImage: round.solution.coverImage,
            points: game.records[index]?.outcome?.points ?? 0,
          }))}
        />
      ) : (
        <OpeningRound
          // A fresh player per round: the old one kept the first <source>.
          key={`${game.view}-${payload[game.view].mediaId}`}
          index={game.view}
          round={payload[game.view]}
          label={`Round ${game.view + 1} · ${tabs[game.view].label}`}
          game={game}
          isLast={game.view === payload.length - 1}
        />
      )}
    </div>
  );
}

function OpeningRound({
  index,
  round,
  label,
  game,
  isLast,
}: {
  index: number;
  round: GuessOpeningRound;
  label: string;
  game: RoundGameState;
  isLast: boolean;
}) {
  const record = game.records[index];
  const fieldRef = useRef<TitleGuessFieldHandle | null>(null);
  const [title, setTitle] = useState(String(record.answers.title ?? ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoShown = Boolean(record.answers.video);
  const artistShown = Boolean(record.answers.artist);
  const hintCost =
    (videoShown ? VIDEO_HINT_COST : 0) + (artistShown ? ARTIST_HINT_COST : 0);
  const hasVideo = Boolean(round.clip.videoUrl);

  const submit = useCallback(
    async (event?: FormEvent) => {
      event?.preventDefault();
      if (busy) return;
      const selection = fieldRef.current?.submit() ?? null;
      const guess = (selection?.value ?? title).trim();
      if (!guess) {
        // One answer per round: never spend it on an accidental blank.
        setError("Type an anime title first.");
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const correct = guess
          ? (await verifyGuess(round.mediaId, guess, selection?.suggestionId))
              .animeMatch
          : false;
        game.submitRound(index, {
          answers: { ...record.answers, title: guess },
          guesses: guess ? [guess] : [],
          outcome: buildOutcome(
            [
              line(
                "Anime",
                guess,
                round.answer,
                correct ? "correct" : "wrong",
                ROUND_POINTS,
              ),
            ],
            hintCost,
          ),
        });
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Couldn't check your answer. Try again.",
        );
      } finally {
        setBusy(false);
      }
    },
    [busy, game, hintCost, index, record.answers, round, title],
  );

  const song = [
    round.meta.songTitle ? `“${round.meta.songTitle}”` : null,
    round.meta.artist,
  ]
    .filter(Boolean)
    .join(" by ");

  if (record.submitted && record.outcome) {
    return (
      <RoundResult
        roundLabel={label}
        outcome={record.outcome}
        answerTitle={round.answer}
        subtitle={[
          song,
          round.meta.sequence ? `OP ${round.meta.sequence}` : null,
          round.meta.season,
        ]
          .filter(Boolean)
          .join(" · ")}
        coverImage={round.solution.coverImage}
        aniListUrl={round.solution.aniListUrl}
        media={
          <OpeningPlayer
            clip={round.clip}
            showVideo
            unrestricted
            label={`Opening for ${round.answer}`}
          />
        }
        onNext={game.advance}
        nextLabel={isLast ? "See final score" : "Next round"}
      />
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <OpeningPlayer
        clip={round.clip}
        showVideo={videoShown}
        label={`Round ${index + 1} opening clip`}
      />
      <div className="flex flex-wrap items-center gap-2">
        {hasVideo ? (
          <HintButton
            label="Unlock video clue"
            cost={VIDEO_HINT_COST}
            disabled={videoShown}
            used="Video unlocked"
            onClick={() => game.takeHint(index, { video: true })}
          />
        ) : null}
        {round.meta.artist ? (
          <HintButton
            label="Show artist"
            cost={ARTIST_HINT_COST}
            disabled={artistShown}
            used="Shown"
            onClick={() => game.takeHint(index, { artist: true })}
          />
        ) : null}
        {artistShown && round.meta.artist ? (
          <span className="rounded border border-line-strong bg-panel-raised px-2 py-1 text-sm text-paper">
            Artist: {round.meta.artist}
          </span>
        ) : null}
      </div>
      <div className="space-y-2">
        <label
          htmlFor={`opening-title-${index}`}
          className="text-sm font-semibold text-paper"
        >
          Which anime is this opening from?
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <TitleGuessField
            ref={fieldRef}
            id={`opening-title-${index}`}
            className="w-full"
            value={title}
            onValueChange={setTitle}
            onSubmit={() => void submit()}
            disabled={busy}
            placeholder="Type an anime title…"
            ariaLabel="Opening anime title"
            suggestionsLabel="Opening title suggestions"
          />
          <button
            type="submit"
            disabled={busy}
            className="button button-primary shrink-0 disabled:opacity-60"
          >
            {busy ? "Checking…" : "Lock in answer"}
          </button>
        </div>
        <p className="text-sm text-muted">
          One answer per round, worth {ROUND_POINTS} points
          {hintCost > 0 ? ` (−${hintCost} for clues)` : ""}.
        </p>
      </div>
      {error ? (
        <p
          role="alert"
          className="rounded-md border border-danger bg-danger-soft px-3 py-2 text-sm text-danger-ink"
        >
          {error}
        </p>
      ) : null}
    </form>
  );
}
