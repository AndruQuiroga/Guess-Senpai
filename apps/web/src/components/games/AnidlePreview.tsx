import type { AnidlePuzzleBundle } from "../../types/puzzles";

interface AnidlePreviewProps {
  bundle?: AnidlePuzzleBundle | null;
}

export function AnidlePreview({ bundle }: AnidlePreviewProps) {
  if (!bundle) return null;

  const synopsisHints = bundle.puzzle.hints?.synopsis ?? [];
  const firstHint = synopsisHints[0];
  const previewText = firstHint?.text ?? "Piece together the anime using a heavily redacted synopsis.";
  const trimmedPreview =
    previewText.length > 220 ? `${previewText.slice(0, 217).trimEnd()}…` : previewText;
  const revealPercent = firstHint ? Math.round(firstHint.ratio * 100) : 30;
  const futurePercents = synopsisHints
    .slice(1)
    .map((hint) => `${Math.round(hint.ratio * 100)}%`)
    .join(", ");

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-brand-400/20 bg-brand-500/5 px-3 py-2 text-left">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-200/80">
          {revealPercent}% revealed synopsis
        </p>
        <p className="mt-2 text-sm leading-relaxed text-neutral-100/90">{trimmedPreview}</p>
      </div>

      {futurePercents ? (
        <p className="text-xs text-neutral-400">
          Later rounds uncover more of the synopsis ({futurePercents}) while stat comparisons stay locked to guess feedback.
        </p>
      ) : (
        <p className="text-xs text-neutral-400">
          Stat comparisons (genres, year, popularity, and more) only appear after you submit guesses.
        </p>
      )}
    </div>
  );
}

