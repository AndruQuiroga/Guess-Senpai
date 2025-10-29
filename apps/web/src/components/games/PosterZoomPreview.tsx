import { formatMediaFormatLabel } from "../../utils/formatMediaFormatLabel";
import type { PosterZoomPuzzleBundle } from "../../types/puzzles";

interface PosterZoomPreviewProps {
  bundle?: PosterZoomPuzzleBundle | null;
}

export function PosterZoomPreview({ bundle }: PosterZoomPreviewProps) {
  if (!bundle) return null;

  const roundHints = bundle.puzzle.spec?.[0]?.hints ?? [];
  const primaryRound = bundle.puzzle.rounds?.[0];
  if (!primaryRound) return null;
  const { meta } = primaryRound;

  return (
    <div className="space-y-3">
      {roundHints.length > 0 ? (
        <ul className="space-y-1 text-sm text-neutral-100/90">
          {roundHints.slice(0, 3).map((hint) => (
            <li key={hint} className="flex items-start gap-2">
              <span aria-hidden className="mt-1 text-emerald-200">•</span>
              <span>{hint}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <dl className="grid gap-x-4 gap-y-2 text-xs text-neutral-300/90 sm:grid-cols-2">
        {meta.genres?.length ? (
          <div>
            <dt className="font-semibold text-neutral-200">Genres</dt>
            <dd>{meta.genres.slice(0, 3).join(" · ")}</dd>
          </div>
        ) : null}
        {meta.format ? (
          <div>
            <dt className="font-semibold text-neutral-200">Format</dt>
            <dd>{formatMediaFormatLabel(meta.format)}</dd>
          </div>
        ) : null}
        {meta.season ? (
          <div>
            <dt className="font-semibold text-neutral-200">Season</dt>
            <dd>{meta.season}</dd>
          </div>
        ) : null}
        {meta.year ? (
          <div>
            <dt className="font-semibold text-neutral-200">Year</dt>
            <dd>{meta.year}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

