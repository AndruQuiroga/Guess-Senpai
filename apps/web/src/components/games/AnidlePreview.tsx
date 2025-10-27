import type { AnidlePuzzleBundle } from "../../types/puzzles";

interface AnidlePreviewProps {
  bundle?: AnidlePuzzleBundle | null;
}

export function AnidlePreview({ bundle }: AnidlePreviewProps) {
  if (!bundle) return null;

  const roundHints = bundle.puzzle.spec?.[0]?.hints ?? [];
  const { genres = [], tags = [], year, episodes, duration, popularity, average_score } =
    bundle.puzzle.hints ?? {};

  const metadata: Array<{ label: string; value: string | number | null | undefined }> = [
    { label: "Year", value: year },
    { label: "Episodes", value: episodes },
    {
      label: "Duration",
      value: duration ? `${duration} min` : null,
    },
    { label: "Popularity", value: popularity },
    { label: "Avg. score", value: average_score ? `${average_score}%` : null },
  ];

  return (
    <div className="space-y-3">
      {roundHints.length > 0 ? (
        <ul className="space-y-1 text-sm text-neutral-100/90">
          {roundHints.slice(0, 3).map((hint) => (
            <li key={hint} className="flex items-start gap-2">
              <span aria-hidden className="mt-1 text-brand-200">
                •
              </span>
              <span>{hint}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <dl className="grid gap-x-4 gap-y-2 text-xs text-neutral-300/90 sm:grid-cols-2">
        {genres.length > 0 ? (
          <div>
            <dt className="font-semibold text-neutral-200">Genres</dt>
            <dd>{genres.slice(0, 3).join(" · ")}</dd>
          </div>
        ) : null}
        {tags.length > 0 ? (
          <div>
            <dt className="font-semibold text-neutral-200">Tags</dt>
            <dd>{tags.slice(0, 3).join(" · ")}</dd>
          </div>
        ) : null}
        {metadata
          .filter((item) => item.value !== null && item.value !== undefined && item.value !== "")
          .slice(0, 3)
          .map((item) => (
            <div key={item.label}>
              <dt className="font-semibold text-neutral-200">{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
      </dl>
    </div>
  );
}

