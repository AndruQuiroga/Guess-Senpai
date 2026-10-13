"use client";

import { useCallback, useMemo, useRef, useState, type FormEvent } from "react";

import type { GameProgress } from "../types/progress";
import type {
  RedactedSynopsisGame,
  RedactedSynopsisRound,
  SolutionPayload,
} from "../types/puzzles";
import { verifyGuess } from "../utils/verifyGuess";
import {
  TitleGuessField,
  type TitleGuessFieldHandle,
} from "./games/TitleGuessField";
import {
  GameSummary,
  HintShop,
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

export const REVEAL_HINT_COST = 150;
export const MAX_REVEAL_HINTS = 3;
/** Share of the hidden words each hint uncovers (title words never are). */
const REVEAL_SHARE = 0.12;

/** Rounds-v3 payloads carry rounds; older ones are one round at the top level. */
export function synopsisRounds(
  payload: RedactedSynopsisGame,
  mediaId: number,
  solution?: SolutionPayload | null,
): RedactedSynopsisRound[] {
  if (payload.rounds?.length) return payload.rounds;
  return [
    {
      order: 1,
      difficulty: 1,
      mediaId,
      answer: payload.answer,
      segments: payload.segments,
      masked_word_indices: payload.masked_word_indices,
      solution: solution ?? {
        titles: { userPreferred: payload.answer },
        aniListUrl: `https://anilist.co/anime/${mediaId}`,
        streamingLinks: [],
      },
    },
  ];
}

/** Indices revealed by `hints` hints, never touching the title's own words. */
function revealedIndices(round: RedactedSynopsisRound, hints: number) {
  const titleWords = new Set(
    round.segments
      .map((segment, index) => ({ segment, index }))
      .filter(({ segment }) =>
        round.answer
          .toLowerCase()
          .split(/\W+/)
          .filter((word) => word.length > 2)
          .includes(segment.text.toLowerCase()),
      )
      .map(({ index }) => index),
  );
  const order = round.masked_word_indices.filter(
    (index) => !titleWords.has(index),
  );
  const perHint = Math.max(2, Math.ceil(order.length * REVEAL_SHARE));
  // Spread reveals across the text instead of uncovering it front to back.
  const spread = [...order].sort(
    (a, b) => ((a * 7919) % 97) - ((b * 7919) % 97) || a - b,
  );
  return new Set(spread.slice(0, perHint * hints));
}

function SynopsisText({
  round,
  revealed,
  showAll = false,
}: {
  round: RedactedSynopsisRound;
  revealed: Set<number>;
  showAll?: boolean;
}) {
  return (
    <p className="whitespace-pre-wrap text-base leading-8 text-paper">
      {round.segments.map((segment, index) => {
        if (!segment.masked || showAll) {
          return (
            <span
              key={index}
              className={
                segment.masked && showAll
                  ? "rounded bg-signal-soft px-0.5 text-paper"
                  : undefined
              }
            >
              {segment.text}
            </span>
          );
        }
        if (revealed.has(index)) {
          return (
            <mark key={index} className="rounded bg-close px-0.5 text-ink">
              {segment.text}
            </mark>
          );
        }
        return (
          <span
            key={index}
            role="img"
            aria-label="redacted word"
            className="mx-0.5 inline-block h-[1.05em] rounded-sm bg-ink align-[-0.15em] ring-1 ring-line-strong"
            style={{
              width: `${Math.min(10, Math.max(2, segment.text.length)) * 0.6}em`,
            }}
          />
        );
      })}
    </p>
  );
}

interface Props {
  payload: RedactedSynopsisGame;
  mediaId: number;
  solution?: SolutionPayload | null;
  initialProgress?: GameProgress;
  onProgressChange(state: GameProgress): void;
  nextSlug?: string | null;
}

export default function SynopsisRedacted({
  payload,
  mediaId,
  solution,
  initialProgress,
  onProgressChange,
  nextSlug,
}: Props) {
  const rounds = useMemo(
    () => synopsisRounds(payload, mediaId, solution),
    [mediaId, payload, solution],
  );
  const game = useRoundGame({
    roundCount: rounds.length,
    initialProgress,
    onProgressChange,
    puzzleKey: rounds.map((round) => round.mediaId).join(":"),
  });
  const tabs = rounds.map((round) => ({
    label: difficultyLabel(round.difficulty, round.order),
  }));

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
      {game.view >= rounds.length ? (
        <GameSummary
          title="Redacted Synopsis"
          nextSlug={nextSlug}
          rows={rounds.map((round, index) => ({
            label: `Round ${index + 1} · ${tabs[index].label}`,
            answer: round.answer,
            coverImage: round.solution.coverImage,
            points: game.records[index]?.outcome?.points ?? 0,
          }))}
        />
      ) : (
        <SynopsisRound
          key={game.view}
          index={game.view}
          round={rounds[game.view]}
          label={`Round ${game.view + 1} · ${tabs[game.view].label}`}
          game={game}
          isLast={game.view === rounds.length - 1}
        />
      )}
    </div>
  );
}

function SynopsisRound({
  index,
  round,
  label,
  game,
  isLast,
}: {
  index: number;
  round: RedactedSynopsisRound;
  label: string;
  game: RoundGameState;
  isLast: boolean;
}) {
  const record = game.records[index];
  const fieldRef = useRef<TitleGuessFieldHandle | null>(null);
  const [title, setTitle] = useState(String(record.answers.title ?? ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hints = Math.min(record.hints, MAX_REVEAL_HINTS);
  const revealed = useMemo(() => revealedIndices(round, hints), [hints, round]);
  const hintCost = hints * REVEAL_HINT_COST;

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
          answers: { title: guess },
          guesses: guess ? [guess] : [],
          outcome: buildOutcome(
            [
              line(
                "Title",
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
    [busy, game, hintCost, index, round, title],
  );

  if (record.submitted && record.outcome) {
    return (
      <RoundResult
        roundLabel={label}
        outcome={record.outcome}
        answerTitle={round.answer}
        subtitle={
          round.solution.titles.english &&
          round.solution.titles.english !== round.answer
            ? round.solution.titles.english
            : null
        }
        coverImage={round.solution.coverImage}
        aniListUrl={round.solution.aniListUrl}
        media={
          <details className="rounded-md border border-line bg-ink p-3">
            <summary className="cursor-pointer text-sm font-semibold text-paper">
              Full synopsis
            </summary>
            <div className="mt-2">
              <SynopsisText round={round} revealed={new Set()} showAll />
            </div>
          </details>
        }
        onNext={game.advance}
        nextLabel={isLast ? "See final score" : "Next round"}
      />
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="rounded-lg border border-line-strong bg-panel p-4 sm:p-5">
        <SynopsisText round={round} revealed={revealed} />
      </div>
      <div>
        <HintShop
          spent={hintCost}
          disabled={busy}
          onBuy={() => game.takeHint(index)}
          clues={[
            {
              id: "reveal",
              label: "Reveal some words",
              cost: REVEAL_HINT_COST,
              uses: { used: hints, max: MAX_REVEAL_HINTS },
              reveal:
                "Revealed words are highlighted. Title words stay hidden.",
            },
          ]}
        />
      </div>
      <div className="space-y-2">
        <label
          htmlFor={`synopsis-title-${index}`}
          className="text-sm font-semibold text-paper"
        >
          Which anime is this?
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <TitleGuessField
            ref={fieldRef}
            id={`synopsis-title-${index}`}
            className="w-full"
            value={title}
            onValueChange={setTitle}
            onSubmit={() => void submit()}
            disabled={busy}
            placeholder="Type an anime title…"
            ariaLabel="Synopsis anime title"
            suggestionsLabel="Synopsis title suggestions"
          />
          <button
            type="submit"
            disabled={busy}
            className="button button-primary shrink-0 disabled:opacity-60"
          >
            {busy ? "Checking…" : "Lock in answer"}
          </button>
        </div>
        <p className="text-sm text-muted">One answer per round.</p>
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
