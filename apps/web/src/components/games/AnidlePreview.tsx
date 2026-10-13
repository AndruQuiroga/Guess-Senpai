import type { AnidlePuzzleBundle } from "../../types/puzzles";

interface AnidlePreviewProps {
  bundle?: AnidlePuzzleBundle | null;
}

export function AnidlePreview({ bundle }: AnidlePreviewProps) {
  if (!bundle) return null;

  const previewText =
    "Compare metadata from your title guesses and use the progressively revealed synopsis hints.";
  const trimmedPreview =
    previewText.length > 220
      ? `${previewText.slice(0, 217).trimEnd()}…`
      : previewText;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-signal bg-signal-soft px-3 py-2 text-left">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-signal-text">
          How Anidle works
        </p>
        <p className="mt-2 text-sm leading-relaxed text-paper">
          {trimmedPreview}
        </p>
      </div>

      <p className="text-xs text-muted">
        This preview does not show today&apos;s answer or clue text.
      </p>
    </div>
  );
}
