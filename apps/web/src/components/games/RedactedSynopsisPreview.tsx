import type { RedactedSynopsisPuzzleBundle } from "../../types/puzzles";

interface RedactedSynopsisPreviewProps {
  bundle?: RedactedSynopsisPuzzleBundle | null;
}

function summarizeText(text: string, maxLength = 180) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

export function RedactedSynopsisPreview({
  bundle,
}: RedactedSynopsisPreviewProps) {
  if (!bundle) return null;

  const roundHints = bundle.puzzle.spec?.[0]?.hints ?? [];
  const segments = bundle.puzzle.segments ?? [];
  const previewSource =
    segments.length > 0
      ? segments
          .map((segment) =>
            segment.masked
              ? segment.text.replace(/./g, "█") || "█"
              : segment.text,
          )
          .join("")
      : bundle.puzzle.text;
  const snippet = summarizeText(previewSource);

  return (
    <div className="space-y-3">
      <p className="rounded-lg border border-[#484b4d] bg-[#242628] p-3 text-sm font-medium leading-relaxed text-[#f4f0e7]">
        {snippet}
      </p>

      {roundHints.length > 0 ? (
        <ul className="space-y-1 text-sm text-[#f4f0e7]">
          {roundHints.slice(0, 2).map((hint) => (
            <li key={hint} className="flex items-start gap-2">
              <span aria-hidden className="mt-1 text-fuchsia-200">
                •
              </span>
              <span>{hint}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
