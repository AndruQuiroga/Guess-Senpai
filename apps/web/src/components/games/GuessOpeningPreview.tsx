import type { GuessOpeningPuzzleBundle } from "../../types/puzzles";

interface GuessOpeningPreviewProps {
  bundle?: GuessOpeningPuzzleBundle | null;
}

function formatLength(lengthSeconds?: number | null) {
  if (!lengthSeconds) return null;
  const minutes = Math.floor(lengthSeconds / 60);
  const seconds = lengthSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds.toString().padStart(2, "0")}s` : `${seconds}s`;
}

export function GuessOpeningPreview({ bundle }: GuessOpeningPreviewProps) {
  if (!bundle) return null;

  const roundHints = bundle.puzzle.spec?.[0]?.hints ?? [];
  const { meta, clip } = bundle.puzzle;

  return (
    <div className="space-y-3">
      {roundHints.length > 0 ? (
        <ul className="space-y-1 text-sm text-neutral-100/90">
          {roundHints.slice(0, 2).map((hint) => (
            <li key={hint} className="flex items-start gap-2">
              <span aria-hidden className="mt-1 text-indigo-200">•</span>
              <span>{hint}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <dl className="grid gap-x-4 gap-y-2 text-xs text-neutral-300/90 sm:grid-cols-2">
        {meta.songTitle ? (
          <div>
            <dt className="font-semibold text-neutral-200">Track cue</dt>
            <dd>{meta.songTitle}</dd>
          </div>
        ) : null}
        {meta.artist ? (
          <div>
            <dt className="font-semibold text-neutral-200">Artist hint</dt>
            <dd>{meta.artist}</dd>
          </div>
        ) : null}
        {meta.season ? (
          <div>
            <dt className="font-semibold text-neutral-200">Season</dt>
            <dd>{meta.season}</dd>
          </div>
        ) : null}
        {meta.sequence ? (
          <div>
            <dt className="font-semibold text-neutral-200">Sequence</dt>
            <dd>OP #{meta.sequence}</dd>
          </div>
        ) : null}
        {formatLength(clip.lengthSeconds) ? (
          <div>
            <dt className="font-semibold text-neutral-200">Clip length</dt>
            <dd>{formatLength(clip.lengthSeconds)}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

