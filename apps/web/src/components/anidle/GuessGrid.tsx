import type { ReactNode } from "react";

import {
  LIST_COLUMNS,
  SCALAR_COLUMNS,
  TONE_CLASS,
  listFeedback,
  listTile,
  scalarFeedback,
  scalarTile,
  type AnidleEvaluationView,
  type Tone,
} from "./tiles";

/*
 * Layout: every guess is a card at every width. The header carries the cover
 * and title, then one row of compact tiles (year, score, popularity, episodes,
 * format, source), then one labelled line each for genres, tags and studio
 * listing every value with its own match/miss chip. A wide table squeezed ten
 * columns into the content width and hid misses behind "+n" counters.
 */
const STAGGER_MS = 70;

const REVEAL_CSS = `
@keyframes anidle-reveal {
  from { opacity: 0; transform: rotateX(80deg) scale(0.9); }
  to { opacity: 1; transform: none; }
}
.anidle-reveal { animation: anidle-reveal 380ms ease-out backwards; }
@media (prefers-reduced-motion: reduce) {
  .anidle-reveal { animation: none; }
}
`;

function revealProps(index: number | null) {
  return index != null
    ? {
        className: "anidle-reveal",
        style: { animationDelay: `${index * STAGGER_MS}ms` },
      }
    : { className: "", style: undefined };
}

function Tile({
  tone,
  label,
  caption,
  animateIndex,
  children,
}: {
  tone: Tone;
  label: string;
  caption: string;
  animateIndex: number | null;
  children: ReactNode;
}) {
  const reveal = revealProps(animateIndex);
  return (
    <div
      role="cell"
      data-tone={tone}
      className={`flex min-h-[3.25rem] min-w-0 flex-col justify-center rounded-md border px-2 py-1.5 text-sm font-semibold ${TONE_CLASS[tone]} ${reveal.className}`}
      style={reveal.style}
    >
      <span className="sr-only">{label}</span>
      <span
        aria-hidden
        className="text-[0.65rem] font-bold uppercase leading-tight tracking-wide opacity-80"
      >
        {caption}
      </span>
      <span aria-hidden className="min-w-0 truncate">
        {children}
      </span>
    </div>
  );
}

const CHIP =
  "inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-semibold leading-tight";
const CHIP_MATCH = `${CHIP} border-correct bg-correct text-ink`;
const CHIP_MISS = `${CHIP} border-line bg-ink text-muted`;

function ListLine({
  caption,
  label,
  tone,
  matched,
  missed,
  animateIndex,
}: {
  caption: string;
  label: string;
  tone: Tone;
  matched: string[];
  missed: string[];
  animateIndex: number | null;
}) {
  const reveal = revealProps(animateIndex);
  return (
    <div
      role="cell"
      data-tone={tone}
      className={`flex min-w-0 items-start gap-3 ${reveal.className}`}
      style={reveal.style}
    >
      <span className="sr-only">{label}</span>
      <span
        aria-hidden
        className="w-14 shrink-0 pt-1 text-[0.65rem] font-bold uppercase tracking-wide text-muted"
      >
        {caption}
      </span>
      <span aria-hidden className="flex min-w-0 flex-1 flex-wrap gap-1">
        {matched.length + missed.length === 0 ? (
          <span className="pt-0.5 text-xs text-muted">—</span>
        ) : null}
        {matched.map((value) => (
          <span key={`m-${value}`} className={CHIP_MATCH}>
            ✓ {value}
          </span>
        ))}
        {missed.map((value) => (
          <span key={`x-${value}`} className={CHIP_MISS}>
            ✗ {value}
          </span>
        ))}
      </span>
    </div>
  );
}

const TILE_LIST_KEYS = new Set(["format", "source"]);
const TILE_LISTS = LIST_COLUMNS.filter((column) =>
  TILE_LIST_KEYS.has(column.key),
);
const LINE_LISTS = LIST_COLUMNS.filter(
  (column) => !TILE_LIST_KEYS.has(column.key),
);

interface GridRowProps {
  evaluation: AnidleEvaluationView;
  attempt: number;
  animate: boolean;
}

function GridRow({ evaluation, attempt, animate }: GridRowProps) {
  let cellIndex = 0;
  const next = () => (animate ? cellIndex++ : null);
  const header = revealProps(next());
  return (
    <div
      role="row"
      data-solved={evaluation.correct ? "true" : undefined}
      className={`space-y-2.5 rounded-lg border p-3 ${
        evaluation.correct
          ? "border-correct bg-correct-soft"
          : "border-line bg-panel"
      }`}
    >
      <div
        role="rowheader"
        className={`flex min-w-0 items-center gap-3 ${header.className}`}
        style={header.style}
      >
        {evaluation.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={evaluation.coverImage}
            alt=""
            width={36}
            height={50}
            className="h-[50px] w-9 shrink-0 rounded-sm object-cover"
          />
        ) : null}
        <p className="min-w-0 flex-1 break-words text-base font-semibold leading-snug text-paper">
          {evaluation.correct ? (
            <span aria-hidden className="mr-1 text-correct">
              ✓
            </span>
          ) : null}
          {evaluation.title}
        </p>
        <p className="shrink-0 text-xs font-semibold text-muted">
          Guess {attempt}
          {evaluation.correct ? (
            <span className="sr-only"> · correct answer</span>
          ) : null}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {SCALAR_COLUMNS.map((column) => {
          const tile = scalarTile(
            column.key,
            scalarFeedback(evaluation, column.key),
          );
          return (
            <Tile
              key={column.key}
              tone={tile.tone}
              label={tile.label}
              caption={column.label}
              animateIndex={next()}
            >
              <span>{tile.value}</span>
              <span className="ml-1 text-base leading-none">{tile.icon}</span>
              {tile.season ? (
                <span className="block text-[0.65rem] font-bold uppercase leading-tight">
                  {tile.season}
                </span>
              ) : null}
            </Tile>
          );
        })}
        {TILE_LISTS.map((column) => {
          const tile = listTile(
            listFeedback(evaluation, column.key),
            column.cap,
          );
          return (
            <Tile
              key={column.key}
              tone={tile.tone}
              label={`${column.label}: ${tile.label}`}
              caption={column.label}
              animateIndex={next()}
            >
              {tile.total === 0
                ? "—"
                : `${tile.matched.length ? "✓ " : ""}${
                    tile.matched[0] ?? tile.unmatched[0]
                  }`}
            </Tile>
          );
        })}
      </div>
      <div className="space-y-1.5">
        {LINE_LISTS.map((column) => {
          const items = listFeedback(evaluation, column.key);
          const tile = listTile(items, items.length);
          return (
            <ListLine
              key={column.key}
              caption={column.label}
              label={`${column.label}: ${tile.label}`}
              tone={tile.tone}
              matched={tile.matched}
              missed={tile.unmatched}
              animateIndex={next()}
            />
          );
        })}
      </div>
    </div>
  );
}

export function GridLegend() {
  const items: { tone: Tone; text: string }[] = [
    { tone: "correct", text: "Correct" },
    { tone: "close", text: "Close" },
    { tone: "wrong", text: "Wrong" },
  ];
  return (
    <ul
      aria-label="Legend"
      className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted"
    >
      {items.map((item) => (
        <li key={item.tone} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={`h-3 w-3 rounded-sm border ${TONE_CLASS[item.tone]}`}
          />
          {item.text}
        </li>
      ))}
      <li>
        <span aria-hidden className="mr-1 font-bold text-paper">
          ↑
        </span>
        Answer is higher
      </li>
      <li>
        <span aria-hidden className="mr-1 font-bold text-paper">
          ↓
        </span>
        Answer is lower
      </li>
      <li>
        <span aria-hidden className="mr-1 font-bold text-paper">
          ✗
        </span>
        Not on the answer
      </li>
    </ul>
  );
}

interface GuessGridProps {
  /** Evaluations in guess order (oldest first); null while still rebuilding. */
  evaluations: (AnidleEvaluationView | null)[];
  /** Index (oldest first) of a row to reveal with the left-to-right stagger. */
  animateIndex?: number | null;
  hydrating?: boolean;
  hydrationProgress?: { completed: number; total: number };
}

export function GuessGrid({
  evaluations,
  animateIndex = null,
  hydrating = false,
  hydrationProgress,
}: GuessGridProps) {
  const rows = evaluations
    .map((evaluation, index) => ({ evaluation, index }))
    .filter(
      (row): row is { evaluation: AnidleEvaluationView; index: number } =>
        row.evaluation != null,
    )
    .reverse();

  if (rows.length === 0 && !hydrating) return null;

  return (
    <section aria-label="Guess history" className="space-y-3">
      <style>{REVEAL_CSS}</style>
      <GridLegend />
      <div className="relative min-h-[4rem]">
        <div role="table" aria-label="Guess history" className="space-y-2.5">
          {rows.map(({ evaluation, index }) => (
            <GridRow
              key={index}
              evaluation={evaluation}
              attempt={index + 1}
              animate={animateIndex === index}
            />
          ))}
        </div>
        {hydrating ? (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-md bg-ink px-6 py-4 text-center"
            role="status"
            aria-live="polite"
          >
            <div
              className="h-6 w-6 animate-spin rounded-full border-2 border-line-strong border-t-paper"
              aria-hidden
            />
            <span className="text-sm font-medium text-paper">
              {hydrationProgress && hydrationProgress.total > 0
                ? `Replaying your guesses… (${hydrationProgress.completed}/${hydrationProgress.total})`
                : "Replaying your guesses…"}
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
