import { useEffect, useMemo, useState } from "react";

import type { AnidleGuessEvaluation } from "../../types/anidle";
import { summarizeEvaluations } from "./summary";

interface KnowledgeSummaryProps {
  evaluations: (AnidleGuessEvaluation | null)[];
}

const CHIP =
  "inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-semibold leading-tight";

/** Ruled-out values shown before "+n more"; tags and studios run long. */
const EXCLUDED_PREVIEW = 8;

function ExcludedValues({ values }: { values: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? values : values.slice(0, EXCLUDED_PREVIEW);
  const hidden = values.length - shown.length;
  return (
    <>
      {shown.map((value) => (
        <span
          key={`x-${value}`}
          className={`${CHIP} border-line bg-ink text-muted line-through decoration-1`}
        >
          <span className="sr-only">not </span>
          {value}
        </span>
      ))}
      {hidden > 0 || expanded ? (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          className={`${CHIP} border-line-strong bg-panel-raised text-paper hover:bg-hover`}
        >
          {expanded ? "Show less" : `+${hidden} more ruled out`}
        </button>
      ) : null}
    </>
  );
}

/** Open above the table on wide screens; collapsed on phones. */
const WIDE_QUERY = "(min-width: 1024px)";

/** "What you know": every guess so far folded into one answer profile. */
export function KnowledgeSummary({ evaluations }: KnowledgeSummaryProps) {
  const knowledge = useMemo(
    () => summarizeEvaluations(evaluations),
    [evaluations],
  );
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    setOpen(window.matchMedia(WIDE_QUERY).matches);
  }, []);
  if (!evaluations.some((entry) => entry != null)) return null;

  return (
    <section
      aria-label="What you know"
      className="rounded-lg border border-line bg-panel"
    >
      <details
        open={open}
        onToggle={(event) => setOpen(event.currentTarget.open)}
        className="group"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted">
          <h2>What you know</h2>
          <span aria-hidden className="transition group-open:rotate-180">
            ▾
          </span>
        </summary>
        <div className="space-y-3 px-4 pb-4">
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {knowledge.scalars.map((item) => (
              <div
                key={item.key}
                className={`rounded-md border px-2 py-1.5 ${
                  item.exact
                    ? "border-correct bg-correct text-ink"
                    : "border-line bg-ink text-paper"
                }`}
              >
                <dt
                  className={`text-[0.65rem] font-bold uppercase tracking-wide ${
                    item.exact ? "" : "text-muted"
                  }`}
                >
                  {item.label}
                </dt>
                <dd className="text-sm font-semibold">{item.text ?? "?"}</dd>
              </div>
            ))}
          </dl>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {knowledge.lists.map((item) => (
              <div key={item.key} className="space-y-1">
                <dt className="text-[0.65rem] font-bold uppercase tracking-wide text-muted">
                  {item.label}
                </dt>
                <dd className="flex flex-wrap gap-1">
                  {item.confirmed.length + item.excluded.length === 0 ? (
                    <span className="text-xs text-muted">?</span>
                  ) : null}
                  {item.confirmed.map((value) => (
                    <span
                      key={`c-${value}`}
                      className={`${CHIP} border-correct bg-correct text-ink`}
                    >
                      ✓ {value}
                    </span>
                  ))}
                  <ExcludedValues values={item.excluded} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </details>
    </section>
  );
}
