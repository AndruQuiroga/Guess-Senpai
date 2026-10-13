import type { ReactNode } from "react";

import {
  LIST_COLUMNS,
  SCALAR_COLUMNS,
  TONE_CLASS,
  listTile,
  scalarTile,
  type AnidleEvaluationView,
  type Tone,
} from "./tiles";

/*
 * Layout choice: below xl each guess is a compact card (title row, then tiles
 * in a 6-column grid) so every colour is visible without scrolling sideways or
 * tapping to expand. From xl the same markup becomes a table-like grid with a
 * header row. Both are driven by one set of grid classes.
 */
const XL_COLUMNS =
  "xl:grid-cols-[minmax(9rem,1.5fr)_repeat(3,minmax(4.25rem,0.8fr))_repeat(2,minmax(6rem,1.4fr))_minmax(4.5rem,1fr)_minmax(4rem,0.8fr)]";
const ROW_GRID = `grid grid-cols-6 gap-1.5 xl:items-stretch ${XL_COLUMNS}`;
const STAGGER_MS = 90;

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

function Tile({
  tone,
  label,
  span,
  caption,
  animateIndex,
  children,
}: {
  tone: Tone;
  label: string;
  span: string;
  caption: string;
  animateIndex: number | null;
  children: ReactNode;
}) {
  return (
    <div
      role="cell"
      data-tone={tone}
      className={`${span} flex min-h-[2.75rem] min-w-0 flex-col justify-center rounded-md border px-2 py-1 text-sm font-semibold xl:col-span-1 ${TONE_CLASS[tone]} ${
        animateIndex != null ? "anidle-reveal" : ""
      }`}
      style={
        animateIndex != null
          ? { animationDelay: `${animateIndex * STAGGER_MS}ms` }
          : undefined
      }
    >
      <span className="sr-only">{label}</span>
      <span
        aria-hidden
        className="text-[0.65rem] font-bold uppercase leading-tight tracking-wide xl:hidden"
      >
        {caption}
      </span>
      <span aria-hidden className="min-w-0">
        {children}
      </span>
    </div>
  );
}

const CHIP = "rounded bg-ink px-1.5 py-0.5 text-xs font-semibold leading-tight";

interface GridRowProps {
  evaluation: AnidleEvaluationView;
  attempt: number;
  animate: boolean;
}

function GridRow({ evaluation, attempt, animate }: GridRowProps) {
  let cellIndex = 0;
  const next = () => (animate ? cellIndex++ : null);
  const titleDelay = next();
  return (
    <div
      role="row"
      data-solved={evaluation.correct ? "true" : undefined}
      className={`${ROW_GRID} rounded-md border p-2 xl:border-0 xl:p-0 ${
        evaluation.correct
          ? "border-correct bg-correct-soft xl:bg-transparent"
          : "border-line bg-panel xl:bg-transparent"
      }`}
    >
      <div
        role="rowheader"
        className={`col-span-6 flex min-w-0 items-center gap-2 xl:col-span-1 xl:rounded-md xl:border xl:px-2 xl:py-1 ${
          evaluation.correct ? "xl:border-correct" : "xl:border-line"
        } ${animate ? "anidle-reveal" : ""}`}
        style={
          titleDelay != null ? { animationDelay: `${titleDelay}ms` } : undefined
        }
      >
        {evaluation.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={evaluation.coverImage}
            alt=""
            width={32}
            height={44}
            className="h-11 w-8 shrink-0 rounded-sm object-cover"
          />
        ) : null}
        <div className="flex min-w-0 flex-1 items-baseline justify-between gap-2 xl:block">
          <p className="line-clamp-2 break-words text-sm font-semibold leading-snug text-paper">
            {evaluation.correct ? (
              <span aria-hidden className="mr-1 text-correct">
                ✓
              </span>
            ) : null}
            {evaluation.title}
          </p>
          <p className="text-xs text-muted">
            Guess {attempt}
            {evaluation.correct ? (
              <span className="sr-only"> · correct answer</span>
            ) : null}
          </p>
        </div>
      </div>
      {SCALAR_COLUMNS.map((column) => {
        const tile = scalarTile(column.key, evaluation[column.key]);
        return (
          <Tile
            key={column.key}
            tone={tile.tone}
            label={tile.label}
            span="col-span-2"
            caption={column.label}
            animateIndex={next()}
          >
            <span className="flex flex-wrap items-baseline gap-x-1">
              <span>{tile.value}</span>
              <span className="text-base leading-none">{tile.icon}</span>
            </span>
            {tile.season ? (
              <span className="block text-[0.65rem] font-bold uppercase leading-tight">
                {tile.season}
              </span>
            ) : null}
          </Tile>
        );
      })}
      {LIST_COLUMNS.map((column) => {
        const tile = listTile(evaluation[column.key], column.cap);
        return (
          <Tile
            key={column.key}
            tone={tile.tone}
            label={`${column.label}: ${tile.label}`}
            span="col-span-3"
            caption={column.label}
            animateIndex={next()}
          >
            {tile.total === 0 ? (
              <span>—</span>
            ) : (
              <span className="flex flex-wrap gap-1">
                {tile.matched.map((value) => (
                  <span key={value} className={`${CHIP} text-correct-ink`}>
                    ✓ {value}
                  </span>
                ))}
                {tile.hiddenCount > 0 ? (
                  <span className={`${CHIP} text-wrong-ink`}>
                    +{tile.hiddenCount}
                  </span>
                ) : null}
              </span>
            )}
          </Tile>
        );
      })}
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
    <section aria-label="Guess history" className="space-y-2">
      <style>{REVEAL_CSS}</style>
      <div className="relative min-h-[4rem]">
        <div role="table" aria-label="Guess history" className="space-y-1.5">
          <div
            role="row"
            className={`hidden px-0 text-xs font-semibold uppercase tracking-wide text-muted xl:grid ${ROW_GRID}`}
          >
            <div role="columnheader">Title</div>
            {SCALAR_COLUMNS.map((column) => (
              <div role="columnheader" key={column.key}>
                {column.label}
              </div>
            ))}
            {LIST_COLUMNS.map((column) => (
              <div role="columnheader" key={column.key}>
                {column.label}
              </div>
            ))}
          </div>
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
      <GridLegend />
    </section>
  );
}
