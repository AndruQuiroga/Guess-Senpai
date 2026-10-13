"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

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
  /** Why it can't be bought yet (e.g. "after 3 more misses"). */
  lockedReason?: string;
  /** Shown under the clue row once bought. */
  reveal?: ReactNode;
}

export interface Stake {
  /** Points the current round (or Anidle guess) can still score. */
  left: number;
  max: number;
}

const StakeContext = createContext<{
  stake: Stake | null;
  setStake(stake: Stake | null): void;
} | null>(null);

/** Lets a game's clue row report its points to the header badge. */
export function StakeProvider({ children }: { children: ReactNode }) {
  const [stake, setStake] = useState<Stake | null>(null);
  const value = useMemo(() => ({ stake, setStake }), [stake]);
  return (
    <StakeContext.Provider value={value}>{children}</StakeContext.Provider>
  );
}

/**
 * Publishes the points still available; cleared when inactive (e.g. on a
 * results screen) or when the reporter unmounts.
 */
export function useReportStake(left: number, max: number, active = true) {
  const context = useContext(StakeContext);
  const setStake = context?.setStake;
  useEffect(() => {
    setStake?.(active ? { left, max } : null);
  }, [active, left, max, setStake]);
  useEffect(() => () => setStake?.(null), [setStake]);
}

/**
 * Subtle header readout: available / total points, with a red ▼ showing what
 * clues (and, in Anidle, guesses) have cost so far.
 */
export function StakeBadge() {
  const stake = useContext(StakeContext)?.stake;
  if (!stake) return null;
  const spent = Math.max(0, stake.max - stake.left);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 text-sm tabular-nums"
      aria-label={`${formatPoints(stake.left)} of ${formatPoints(stake.max)} points available${
        spent ? `, ${formatPoints(spent)} spent` : ""
      }`}
      role="status"
    >
      <span aria-hidden className="font-semibold text-paper">
        {formatPoints(stake.left)}
      </span>
      <span aria-hidden className="text-muted">
        / {formatPoints(stake.max)}
      </span>
      {spent > 0 ? (
        <span aria-hidden className="text-xs font-semibold text-danger-ink">
          ▼{formatPoints(spent)}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Optional clues as a compact row of small buttons ("Genres −150"). Bought
 * clues show a ✓ and their content underneath; locked ones say why. The
 * points they cost are reported to the header badge.
 */
export function HintShop({
  clues,
  spent,
  onBuy,
  max = ROUND_POINTS,
  disabled = false,
}: {
  clues: ShopClue[];
  /** Points already spent this round (clues, and guesses in Anidle). */
  spent: number;
  onBuy(id: string): void;
  max?: number;
  disabled?: boolean;
}) {
  useReportStake(Math.max(0, max - spent), max);
  if (clues.length === 0) return null;
  const revealed = clues.filter(
    (clue) => clue.reveal && (clue.bought || (clue.uses?.used ?? 0) > 0),
  );
  return (
    <section aria-label="Clues" className="space-y-1.5">
      <ul className="flex flex-wrap items-center gap-1.5 text-sm">
        <li className="text-xs font-semibold uppercase tracking-wide text-muted">
          Clues
        </li>
        {clues.map((clue) => {
          const used = clue.uses?.used ?? (clue.bought ? 1 : 0);
          const maxed = clue.uses
            ? used >= clue.uses.max
            : Boolean(clue.bought);
          const locked = Boolean(clue.lockedReason) && !maxed;
          return (
            <li key={clue.id}>
              <button
                type="button"
                onClick={() => onBuy(clue.id)}
                disabled={disabled || locked || maxed}
                title={locked ? clue.lockedReason : undefined}
                aria-label={
                  maxed
                    ? `${clue.label}: bought`
                    : `Buy ${clue.label.toLowerCase()} for ${clue.cost} points${
                        locked ? ` (${clue.lockedReason})` : ""
                      }`
                }
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition disabled:cursor-not-allowed ${
                  maxed
                    ? "border-signal bg-signal-soft text-paper"
                    : locked
                      ? "border-line text-muted opacity-60"
                      : "border-line-strong text-paper hover:bg-hover"
                }`}
              >
                {maxed ? <span aria-hidden>✓</span> : null}
                <span>{clue.label}</span>
                {clue.uses && clue.uses.max > 1 ? (
                  <span className="text-xs text-muted">
                    {used}/{clue.uses.max}
                  </span>
                ) : null}
                {maxed ? null : (
                  <span className="text-xs font-semibold text-danger-ink">
                    −{formatPoints(clue.cost)}
                  </span>
                )}
              </button>
              {locked ? (
                <span className="sr-only">{clue.lockedReason}</span>
              ) : null}
            </li>
          );
        })}
      </ul>
      {clues.some((clue) => clue.lockedReason && !clue.bought) ? (
        <p className="text-xs text-muted">
          {clues
            .filter((clue) => clue.lockedReason && !clue.bought)
            .map((clue) => `${clue.label}: ${clue.lockedReason}`)
            .join(" · ")}
        </p>
      ) : null}
      {revealed.length ? (
        <dl className="space-y-0.5 text-sm" aria-live="polite">
          {revealed.map((clue) => (
            <div key={clue.id} className="flex flex-wrap gap-x-2">
              <dt className="text-muted">{clue.label}:</dt>
              <dd className="text-paper">{clue.reveal}</dd>
            </div>
          ))}
        </dl>
      ) : null}
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
