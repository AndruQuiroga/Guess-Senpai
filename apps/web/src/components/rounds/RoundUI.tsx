"use client";

import { useEffect, useRef, type ReactNode } from "react";

import NextPuzzleButton from "../NextPuzzleButton";
import type { RoundRecord } from "./useRoundGame";
import {
  formatPoints,
  ROUND_POINTS,
  type RoundOutcome,
  type ScoreLine,
} from "./scoring";

export interface RoundTabInfo {
  label: string;
}

/** Round 1 · Easy / Round 2 · Medium / Round 3 · Hard, then Results. */
export function RoundTabs({
  rounds,
  records,
  view,
  canView,
  onSelect,
}: {
  rounds: RoundTabInfo[];
  records: RoundRecord[];
  view: number;
  canView(index: number): boolean;
  onSelect(index: number): void;
}) {
  const finished = records.every((record) => record.submitted);
  return (
    <nav aria-label="Rounds" className="flex flex-wrap gap-2">
      {rounds.map((round, index) => {
        const record = records[index];
        const active = view === index;
        const enabled = canView(index);
        return (
          <button
            key={round.label + index}
            type="button"
            disabled={!enabled}
            aria-current={active ? "step" : undefined}
            onClick={() => onSelect(index)}
            className={`flex min-h-11 items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
              active
                ? "border-signal bg-signal-soft text-paper"
                : record?.submitted
                  ? "border-line-strong bg-panel text-paper hover:bg-hover"
                  : "border-line bg-panel text-muted"
            }`}
          >
            <span>
              Round {index + 1}
              <span className="font-normal text-muted"> · {round.label}</span>
            </span>
            {record?.submitted && record.outcome ? (
              <span className="rounded bg-ink px-1.5 py-0.5 text-xs text-paper">
                {formatPoints(record.outcome.points)}
              </span>
            ) : null}
          </button>
        );
      })}
      {finished ? (
        <button
          type="button"
          aria-current={view === rounds.length ? "step" : undefined}
          onClick={() => onSelect(rounds.length)}
          className={`min-h-11 rounded-md border px-3 py-1.5 text-sm font-semibold transition ${
            view === rounds.length
              ? "border-signal bg-signal-soft text-paper"
              : "border-line-strong bg-panel text-paper hover:bg-hover"
          }`}
        >
          Results
        </button>
      ) : null}
    </nav>
  );
}

export interface ShopClue {
  id: string;
  label: string;
  cost: number;
  /** Repeatable clues (zoom out, reveal words): how many of how many. */
  uses?: { used: number; max: number };
  /** One-off clues: already bought. */
  bought?: boolean;
  /** Why it can't be bought yet (e.g. another clue must come first). */
  lockedReason?: string;
  /** Shown under the clue once bought. */
  reveal?: ReactNode;
}

/**
 * One place to buy clues. The round starts at `max` points; every clue shows
 * its price up front and lowers what the round can still score, which the
 * meter at the top tracks.
 */
export function HintShop({
  clues,
  spent,
  onBuy,
  max = ROUND_POINTS,
  disabled = false,
  note = "Clues are optional and lower the most this round can score.",
}: {
  clues: ShopClue[];
  /** One line under the meter explaining what lowers the points. */
  note?: string;
  /** Points already spent on clues this round. */
  spent: number;
  onBuy(id: string): void;
  max?: number;
  disabled?: boolean;
}) {
  const left = Math.max(0, max - spent);
  return (
    <section
      aria-label="Clues"
      className="space-y-3 rounded-lg border border-line bg-panel p-3 sm:p-4"
    >
      <div className="space-y-1.5">
        <p className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
          <span className="font-semibold text-paper">
            Playing for{" "}
            <span
              className="font-display text-lg tabular-nums"
              aria-live="polite"
            >
              {formatPoints(left)}
            </span>{" "}
            <span className="text-muted">/ {formatPoints(max)} pts</span>
          </span>
          <span className="text-xs text-muted">{note}</span>
        </p>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-ink"
          role="presentation"
        >
          <div
            className="h-full bg-signal transition-[width]"
            style={{ width: `${(left / max) * 100}%` }}
          />
        </div>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {clues.map((clue) => {
          const maxed = clue.uses
            ? clue.uses.used >= clue.uses.max
            : Boolean(clue.bought);
          const locked = Boolean(clue.lockedReason) && !maxed;
          const state = clue.uses
            ? `${clue.uses.used} of ${clue.uses.max} bought`
            : clue.bought
              ? "Bought"
              : null;
          return (
            <li
              key={clue.id}
              className={`space-y-2 rounded-md border px-3 py-2 ${
                clue.bought || (clue.uses?.used ?? 0) > 0
                  ? "border-signal bg-signal-soft"
                  : "border-line bg-ink"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-paper">
                    {clue.label}
                  </p>
                  <p className="text-xs text-muted">
                    {locked
                      ? clue.lockedReason
                      : (state ?? `−${formatPoints(clue.cost)} pts`)}
                  </p>
                </div>
                {maxed ? null : (
                  <button
                    type="button"
                    onClick={() => onBuy(clue.id)}
                    disabled={disabled || locked}
                    aria-label={`Buy ${clue.label.toLowerCase()} for ${clue.cost} points`}
                    className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md border border-line-strong bg-panel-raised px-3 text-sm font-semibold text-paper transition hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Buy
                    <span className="text-xs font-normal text-muted">
                      −{formatPoints(clue.cost)}
                    </span>
                  </button>
                )}
              </div>
              {clue.reveal && (clue.bought || (clue.uses?.used ?? 0) > 0) ? (
                <div className="text-sm text-paper" aria-live="polite">
                  {clue.reveal}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** An optional clue; its cost is always shown before it is taken. */
export function HintButton({
  label,
  cost,
  onClick,
  disabled = false,
  used,
}: {
  label: string;
  cost: number;
  onClick(): void;
  disabled?: boolean;
  /** Shown instead of the cost once there is nothing left to reveal. */
  used?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line-strong bg-panel px-3 py-1.5 text-sm font-semibold text-paper transition hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
      <span className="text-xs font-normal text-muted">
        {disabled && used ? used : `−${formatPoints(cost)} pts`}
      </span>
    </button>
  );
}

export const VERDICT: Record<
  ScoreLine["verdict"],
  { icon: string; text: string; tone: string }
> = {
  correct: { icon: "✓", text: "Correct", tone: "text-correct" },
  close: { icon: "≈", text: "Close", tone: "text-close" },
  wrong: { icon: "✗", text: "Wrong", tone: "text-wrong-ink" },
};

function ScoreTable({ outcome }: { outcome: RoundOutcome }) {
  return (
    <table className="w-full border-collapse text-left text-sm">
      <caption className="sr-only">Round breakdown</caption>
      <thead>
        <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
          <th scope="col" className="py-2 pr-3 font-semibold">
            Question
          </th>
          <th scope="col" className="py-2 pr-3 font-semibold">
            Your answer
          </th>
          <th scope="col" className="py-2 pr-3 font-semibold">
            Answer
          </th>
          <th scope="col" className="py-2 text-right font-semibold">
            Points
          </th>
        </tr>
      </thead>
      <tbody>
        {outcome.lines.map((entry, index) => {
          const verdict = VERDICT[entry.verdict];
          return (
            <tr
              key={`${entry.label}-${index}`}
              className="border-b border-line align-top"
            >
              <th scope="row" className="py-2 pr-3 font-semibold text-paper">
                {entry.label}
              </th>
              <td className="py-2 pr-3">
                <span
                  className={`mr-1.5 font-bold ${verdict.tone}`}
                  aria-hidden
                >
                  {verdict.icon}
                </span>
                <span className="sr-only">{verdict.text}: </span>
                <span className={entry.guess ? "text-paper" : "text-muted"}>
                  {entry.guess || "No answer"}
                </span>
              </td>
              <td className="py-2 pr-3 text-paper">{entry.answer}</td>
              <td className="py-2 text-right tabular-nums text-paper">
                {formatPoints(entry.points)}
                <span className="text-muted"> / {formatPoints(entry.max)}</span>
              </td>
            </tr>
          );
        })}
        {outcome.hintPenalty > 0 ? (
          <tr className="border-b border-line">
            <th
              scope="row"
              colSpan={3}
              className="py-2 pr-3 font-semibold text-muted"
            >
              Hints used
            </th>
            <td className="py-2 text-right tabular-nums text-wrong-ink">
              −{formatPoints(outcome.hintPenalty)}
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}

/**
 * Results screen after a round's single submission: the answer, its art,
 * what was right or wrong and the points earned. Focus moves here so screen
 * reader and keyboard users land on the outcome.
 */
export function RoundResult({
  roundLabel,
  outcome,
  answerTitle,
  subtitle,
  coverImage,
  aniListUrl,
  media,
  breakdown = true,
  onNext,
  nextLabel,
}: {
  roundLabel: string;
  outcome: RoundOutcome;
  answerTitle: string;
  subtitle?: string | null;
  coverImage?: string | null;
  aniListUrl?: string | null;
  /** Game-specific reveal (full synopsis, characters, playable opening). */
  media?: ReactNode;
  /**
   * Show the answer block and per-question table. Off when `media` already
   * shows each answer in place (the character cards).
   */
  breakdown?: boolean;
  onNext(): void;
  nextLabel: string;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  const perfect = outcome.points >= outcome.max;
  const verdict =
    outcome.points === 0 ? "Missed" : perfect ? "Perfect round" : "Nice";

  return (
    <section
      aria-labelledby="round-result-heading"
      className="space-y-5 rounded-lg border border-line-strong bg-panel p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted">
            {roundLabel}
          </p>
          <h2
            id="round-result-heading"
            ref={headingRef}
            tabIndex={-1}
            className="font-display text-2xl font-bold text-paper outline-none"
          >
            {verdict}
          </h2>
        </div>
        <p className="text-right" aria-live="polite">
          <span
            className={`font-display text-4xl font-bold tabular-nums ${
              outcome.points === 0 ? "text-wrong-ink" : "text-correct"
            }`}
          >
            +{formatPoints(outcome.points)}
          </span>
          <span className="block text-sm text-muted">
            of {formatPoints(outcome.max)} points
          </span>
        </p>
      </div>

      {breakdown ? (
        <div
          className={
            coverImage
              ? "grid gap-5 sm:grid-cols-[9rem_minmax(0,1fr)]"
              : "space-y-4"
          }
        >
          {coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverImage}
              alt={`Cover art for ${answerTitle}`}
              className="aspect-[2/3] w-32 rounded-md border border-line object-cover sm:w-full"
            />
          ) : null}
          <div className="min-w-0 space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted">
                Answer
              </p>
              <p className="text-xl font-semibold text-paper">{answerTitle}</p>
              {subtitle ? (
                <p className="text-sm text-muted">{subtitle}</p>
              ) : null}
              {aniListUrl ? (
                <a
                  href={aniListUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-signal-text underline"
                >
                  View on AniList
                </a>
              ) : null}
            </div>
            <ScoreTable outcome={outcome} />
          </div>
        </div>
      ) : outcome.hintPenalty > 0 ? (
        <p className="text-sm text-muted">
          Hints used:{" "}
          <span className="tabular-nums text-wrong-ink">
            −{formatPoints(outcome.hintPenalty)}
          </span>
        </p>
      ) : null}

      {media}

      <button
        type="button"
        onClick={onNext}
        className="button button-primary w-full sm:w-auto"
      >
        {nextLabel} <span aria-hidden>→</span>
      </button>
    </section>
  );
}

export interface SummaryRow {
  label: string;
  answer: string;
  coverImage?: string | null;
  points: number;
}

/** End of game: every round's answer and points, then the next game. */
export function GameSummary({
  title,
  rows,
  nextSlug,
}: {
  title: string;
  rows: SummaryRow[];
  nextSlug?: string | null;
}) {
  const total = rows.reduce((sum, row) => sum + row.points, 0);
  const max = rows.length * ROUND_POINTS;
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  return (
    <section
      aria-labelledby="game-summary-heading"
      className="space-y-5 rounded-lg border border-line-strong bg-panel p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2
          id="game-summary-heading"
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-2xl font-bold text-paper outline-none"
        >
          {title} complete
        </h2>
        <p className="text-right">
          <span className="font-display text-4xl font-bold tabular-nums text-paper">
            {formatPoints(total)}
          </span>
          <span className="block text-sm text-muted">
            of {formatPoints(max)} points
          </span>
        </p>
      </div>
      <ol className="grid gap-3 sm:grid-cols-3">
        {rows.map((row, index) => (
          <li
            key={`${row.label}-${index}`}
            className="flex gap-3 rounded-md border border-line bg-ink p-3"
          >
            {row.coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={row.coverImage}
                alt=""
                className="h-20 w-14 shrink-0 rounded-sm object-cover"
              />
            ) : null}
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">
                {row.label}
              </p>
              <p className="line-clamp-2 text-sm font-semibold text-paper">
                {row.answer}
              </p>
              <p className="text-sm tabular-nums text-paper">
                {formatPoints(row.points)}
                <span className="text-muted">
                  {" "}
                  / {formatPoints(ROUND_POINTS)}
                </span>
              </p>
            </div>
          </li>
        ))}
      </ol>
      <NextPuzzleButton nextSlug={nextSlug} />
    </section>
  );
}

/** Shown for games finished before rounds v3 shipped (no stored results). */
export function LegacyFinished({ nextSlug }: { nextSlug?: string | null }) {
  return (
    <section className="space-y-3 rounded-lg border border-line bg-panel p-4">
      <p className="text-base text-paper">
        You finished today&apos;s game before the new round format arrived.
        Tomorrow&apos;s puzzle uses Easy, Medium and Hard rounds with points.
      </p>
      <NextPuzzleButton nextSlug={nextSlug} />
    </section>
  );
}

/** Header status for the round games: "Round 2 / 3 · 1,450 pts". */
export function roundStatus(
  playedCount: number,
  roundCount: number,
  totalPoints: number,
): string {
  const round = Math.min(roundCount, playedCount + 1);
  const where =
    playedCount >= roundCount ? "Done" : `Round ${round} / ${roundCount}`;
  return `${where} · ${formatPoints(totalPoints)} pts`;
}
