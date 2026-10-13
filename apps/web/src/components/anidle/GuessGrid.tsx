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
  type ListKey,
  type Tone,
} from "./tiles";

/*
 * Layout: a real table with one column per attribute (Title, Year, Score,
 * Popularity, Episodes, Format, Source, Genres, Tags, Studio), newest guess on
 * top. It scrolls sideways on narrow screens with the title column pinned.
 * Every cell carries a screen-reader sentence, and tone is always backed by an
 * icon or text. List columns show matches (✓) before misses (✗); genres are
 * always complete, tags and studios fold the rest into "+n" so a long tag or
 * production-committee list can't swamp the row. Inside the wide page layout
 * every column fits without scrolling on a desktop screen.
 */
const STAGGER_MS = 70;
const LIST_LIMITS: Partial<Record<ListKey, number>> = { tags: 3, studios: 2 };
/** Room for chips to wrap two or three to a line instead of stacking. */
const LIST_WIDTHS: Partial<Record<ListKey, string>> = {
  genres: "w-[13rem]",
  tags: "w-[15rem]",
  studios: "w-[12rem]",
};

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

const CELL = "border-b border-line px-1 py-1.5 align-top";

function Swatch({
  tone,
  animateIndex,
  children,
}: {
  tone: Tone;
  animateIndex: number | null;
  children: ReactNode;
}) {
  const reveal = revealProps(animateIndex);
  return (
    <div
      className={`flex min-h-[3.25rem] flex-col justify-center rounded-md border px-2 py-1 text-base font-semibold ${TONE_CLASS[tone]} ${reveal.className}`}
      style={reveal.style}
    >
      {children}
    </div>
  );
}

const CHIP =
  "inline-flex max-w-[11rem] items-center rounded px-1.5 py-0.5 text-xs font-semibold leading-tight";

function ListCell({
  columnKey,
  matched,
  missed,
  animateIndex,
}: {
  columnKey: ListKey;
  matched: string[];
  missed: string[];
  animateIndex: number | null;
}) {
  const reveal = revealProps(animateIndex);
  const all = [
    ...matched.map((value) => ({ value, match: true })),
    ...missed.map((value) => ({ value, match: false })),
  ];
  const limit = LIST_LIMITS[columnKey] ?? all.length;
  const shown = all.slice(0, limit);
  const hidden = all.slice(limit);
  if (all.length === 0) {
    return <span className="px-1 text-xs text-muted">—</span>;
  }
  return (
    <ul
      className={`flex flex-wrap items-start gap-1 ${reveal.className}`}
      style={reveal.style}
    >
      {shown.map((item) => (
        <li
          key={`${item.match ? "m" : "x"}-${item.value}`}
          className={`${CHIP} ${
            item.match
              ? "bg-correct text-ink"
              : "border border-line bg-ink text-muted"
          }`}
        >
          <span aria-hidden className="mr-1">
            {item.match ? "✓" : "✗"}
          </span>
          <span className="truncate" title={item.value}>
            {item.value}
          </span>
        </li>
      ))}
      {hidden.length > 0 ? (
        <li
          className={`${CHIP} border border-line bg-ink text-muted`}
          title={hidden.map((item) => item.value).join(", ")}
        >
          +{hidden.length}
        </li>
      ) : null}
    </ul>
  );
}

interface GridRowProps {
  evaluation: AnidleEvaluationView;
  attempt: number;
  animate: boolean;
}

function GridRow({ evaluation, attempt, animate }: GridRowProps) {
  let cellIndex = 0;
  const next = () => (animate ? cellIndex++ : null);
  const title = revealProps(next());
  return (
    <tr data-solved={evaluation.correct ? "true" : undefined}>
      <th
        scope="row"
        className={`${CELL} sticky left-0 z-10 bg-surface-raised text-left font-normal`}
      >
        <div
          className={`flex w-44 min-w-0 items-center gap-3 rounded-md border px-2 py-1.5 xl:w-56 ${
            evaluation.correct
              ? "border-correct bg-correct-soft"
              : "border-line"
          } ${title.className}`}
          style={title.style}
        >
          {evaluation.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={evaluation.coverImage}
              alt=""
              width={44}
              height={64}
              className="h-16 w-11 shrink-0 rounded-sm object-cover"
            />
          ) : null}
          <div className="min-w-0">
            <p className="line-clamp-3 break-words text-base font-semibold leading-snug text-paper">
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
      </th>
      {SCALAR_COLUMNS.map((column) => {
        const tile = scalarTile(
          column.key,
          scalarFeedback(evaluation, column.key),
        );
        return (
          <td key={column.key} data-tone={tile.tone} className={CELL}>
            <span className="sr-only">{tile.label}</span>
            <Swatch tone={tile.tone} animateIndex={next()}>
              <span aria-hidden className="whitespace-nowrap">
                {tile.value}
                <span className="ml-1 text-base leading-none">{tile.icon}</span>
              </span>
              {tile.season ? (
                <span
                  aria-hidden
                  className="text-[0.65rem] font-bold uppercase leading-tight"
                >
                  {tile.season}
                </span>
              ) : null}
            </Swatch>
          </td>
        );
      })}
      {LIST_COLUMNS.map((column) => {
        const items = listFeedback(evaluation, column.key);
        const tile = listTile(items, items.length);
        const single = column.cap === 1;
        return (
          <td key={column.key} data-tone={tile.tone} className={CELL}>
            <span className="sr-only">{`${column.label}: ${tile.label}`}</span>
            <div aria-hidden>
              {single ? (
                <Swatch tone={tile.tone} animateIndex={next()}>
                  <span className="whitespace-nowrap">
                    {tile.total === 0
                      ? "—"
                      : `${tile.matched.length ? "✓ " : ""}${
                          tile.matched[0] ?? tile.unmatched[0]
                        }`}
                  </span>
                </Swatch>
              ) : (
                <ListCell
                  columnKey={column.key}
                  matched={tile.matched}
                  missed={tile.unmatched}
                  animateIndex={next()}
                />
              )}
            </div>
          </td>
        );
      })}
    </tr>
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
        <div className="overflow-x-auto rounded-lg border border-line bg-surface-raised">
          <table className="w-full min-w-[52rem] border-collapse text-left">
            <caption className="sr-only">
              Guess history, newest first. Each column compares one attribute
              with the answer.
            </caption>
            <thead>
              <tr className="text-xs font-semibold uppercase tracking-wide text-muted">
                <th
                  scope="col"
                  className="sticky left-0 z-10 bg-surface-raised px-2 py-2"
                >
                  Title
                </th>
                {SCALAR_COLUMNS.map((column) => (
                  <th scope="col" className="px-2 py-2" key={column.key}>
                    {column.label}
                  </th>
                ))}
                {LIST_COLUMNS.map((column) => (
                  <th
                    scope="col"
                    className={`px-2 py-2 ${LIST_WIDTHS[column.key] ?? ""}`}
                    key={column.key}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ evaluation, index }) => (
                <GridRow
                  key={index}
                  evaluation={evaluation}
                  attempt={index + 1}
                  animate={animateIndex === index}
                />
              ))}
            </tbody>
          </table>
        </div>
        {hydrating ? (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-md bg-ink px-6 py-4 text-center"
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
