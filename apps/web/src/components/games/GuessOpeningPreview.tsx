import type {
  GuessOpeningPuzzleBundle,
  GuessOpeningRound,
} from "../../types/puzzles";

interface GuessOpeningPreviewProps {
  bundle?: GuessOpeningPuzzleBundle | null;
}

function formatLength(lengthSeconds?: number | null) {
  if (!lengthSeconds) return null;
  const minutes = Math.floor(lengthSeconds / 60);
  const seconds = lengthSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds.toString().padStart(2, "0")}s` : `${seconds}s`;
}

function collectRoundMetadata(round: GuessOpeningRound) {
  const entries = new Set<string>();

  round.spec?.forEach((stage) => {
    stage.hints.forEach((hint) => {
      if (hint === "season" && round.meta.season) {
        entries.add(`Season ${round.meta.season}`);
      }
      if (hint === "artist" && round.meta.artist) {
        entries.add(`Artist ${round.meta.artist}`);
      }
      if (hint === "song" && round.meta.songTitle) {
        entries.add(`Song ${round.meta.songTitle}`);
      }
      if (hint === "sequence" && round.meta.sequence) {
        entries.add(`OP #${round.meta.sequence}`);
      }
      if (hint === "length") {
        const formatted = formatLength(round.clip?.lengthSeconds);
        if (formatted) {
          entries.add(`Length ${formatted}`);
        }
      }
    });
  });

  return Array.from(entries);
}

export function GuessOpeningPreview({ bundle }: GuessOpeningPreviewProps) {
  if (!bundle) return null;

  const rounds = bundle.puzzle.rounds ?? [];
  if (rounds.length === 0) return null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-100/90">
        Three openings per day. Clear all of them to lock in today&apos;s Guess the Opening win.
      </p>
      <ul className="space-y-3">
        {rounds.map((round, index) => {
          const metadata = collectRoundMetadata(round);
          return (
            <li key={`${round.mediaId}-${index}`} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-300">
                Opening {index + 1}
              </p>
              {metadata.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 text-[0.7rem] uppercase tracking-wide text-neutral-200/80">
                  {metadata.map((entry) => (
                    <span
                      key={entry}
                      className="rounded-full border border-white/10 bg-white/10 px-3 py-1 font-semibold text-white/80"
                    >
                      {entry}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[0.72rem] text-neutral-400">Hints unlock as you progress.</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

