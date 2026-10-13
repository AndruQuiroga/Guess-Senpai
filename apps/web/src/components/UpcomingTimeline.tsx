import { type MouseEvent } from "react";

import { type GameDirectoryEntry } from "../config/games";

export type UpcomingTimelineProps = {
  games: GameDirectoryEntry[];
  unlockLabels: Record<string, string>;
  onPreview?: (game: GameDirectoryEntry) => void;
  statusUnavailable?: boolean;
  onRetry?: () => void;
  availabilityLoading?: boolean;
};

export function UpcomingTimeline({
  games,
  unlockLabels,
  onPreview,
  statusUnavailable = false,
  onRetry,
  availabilityLoading = false,
}: UpcomingTimelineProps): JSX.Element | null {
  if (games.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.32em] text-[#c1c2bd]">
            Upcoming lineup
          </span>
          <span aria-hidden className="hidden text-neutral-500 sm:inline">
            •
          </span>
          <span className="text-sm text-[#c1c2bd]">
            Other modes and their current availability.
          </span>
        </div>
        {statusUnavailable ? (
          <div className="flex items-center gap-3 text-xs text-amber-100">
            <span className="inline-flex items-center gap-1 rounded-full border border-[#c9a13e] bg-[#3d3220] px-3 py-1 font-medium">
              <span aria-hidden>⚠️</span>
              Opening mode status unavailable
            </span>
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                disabled={availabilityLoading}
                className="inline-flex items-center gap-2 rounded-full border border-[#c9a13e] bg-transparent px-3 py-1 font-semibold uppercase tracking-[0.18em] text-amber-100 transition hover:border-[#c9a13e] hover:text-amber-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200/70"
              >
                Retry
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div
        className="flex gap-3 overflow-x-auto pb-1"
        role="list"
        aria-label="Upcoming games timeline"
      >
        {games.map((game) => {
          const unlockNote = unlockLabels[game.slug] ?? "Unlocking soon.";
          const handleClick = onPreview
            ? (event: MouseEvent<HTMLButtonElement>) => {
                event.preventDefault();
                event.stopPropagation();
                onPreview(game);
              }
            : undefined;

          const content = (
            <div className="flex min-w-[200px] shrink-0 flex-col gap-1 rounded-lg border border-[#686b6d] bg-[#2c2f31] px-4 py-3 text-left transition hover:border-[#686b6d] hover:bg-white/[0.12] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70">
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-[#f4f0e7]">
                {game.title}
              </span>
              <span className="text-sm text-[#c1c2bd]">{unlockNote}</span>
            </div>
          );

          return (
            <div key={game.slug} role="listitem" className="shrink-0">
              {onPreview ? (
                <button
                  type="button"
                  onClick={handleClick}
                  className="group focus-visible:outline-none"
                >
                  <span className="sr-only">Preview {game.title}</span>
                  {content}
                </button>
              ) : (
                content
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
