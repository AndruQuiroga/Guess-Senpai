import type { CharacterSilhouettePuzzleBundle } from "../../types/puzzles";

interface CharacterSilhouettePreviewProps {
  bundle?: CharacterSilhouettePuzzleBundle | null;
}

export function CharacterSilhouettePreview({ bundle }: CharacterSilhouettePreviewProps) {
  if (!bundle) return null;

  const rounds = bundle.puzzle.rounds ?? [];
  const totalRounds = rounds.length > 0 ? rounds.length : bundle.puzzle.spec?.length ?? 1;
  const totalCards = rounds.reduce((sum, round) => sum + (round.entries?.length ?? 0), 0);
  const featuredCharacter = bundle.puzzle.character;

  return (
    <div className="space-y-4 text-neutral-100/90">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-neutral-100">Three-round lineup</p>
        <p className="text-sm text-neutral-300/90">
          Clear {totalRounds} escalating reveal rounds, each with four silhouettes pulled from the same series.
        </p>
      </div>

      <dl className="grid gap-x-4 gap-y-2 text-xs text-neutral-300/90 sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-neutral-200">Cards in play</dt>
          <dd>{totalCards || 12}</dd>
        </div>
        {featuredCharacter?.role ? (
          <div>
            <dt className="font-semibold text-neutral-200">Anchor role</dt>
            <dd>{featuredCharacter.role}</dd>
          </div>
        ) : null}
        <div>
          <dt className="font-semibold text-neutral-200">Final reveal</dt>
          <dd>Guess both the anime and character to fully uncover the portrait.</dd>
        </div>
      </dl>
    </div>
  );
}

