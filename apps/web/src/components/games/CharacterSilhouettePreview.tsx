import type { CharacterSilhouettePuzzleBundle } from "../../types/puzzles";

interface CharacterSilhouettePreviewProps {
  bundle?: CharacterSilhouettePuzzleBundle | null;
}

export function CharacterSilhouettePreview({ bundle }: CharacterSilhouettePreviewProps) {
  if (!bundle) return null;

  const firstStage = bundle.puzzle.spec?.[0];
  const character = bundle.puzzle.character;

  return (
    <div className="space-y-3">
      {firstStage ? (
        <div className="space-y-1 text-sm text-neutral-100/90">
          <p className="font-semibold text-neutral-100">{firstStage.label}</p>
          {firstStage.description ? (
            <p className="text-sm text-neutral-300/90">{firstStage.description}</p>
          ) : null}
        </div>
      ) : null}

      <dl className="grid gap-x-4 gap-y-2 text-xs text-neutral-300/90 sm:grid-cols-2">
        {character.role ? (
          <div>
            <dt className="font-semibold text-neutral-200">Role hint</dt>
            <dd>{character.role}</dd>
          </div>
        ) : null}
        <div>
          <dt className="font-semibold text-neutral-200">Silhouette filter</dt>
          <dd>{firstStage?.filter ?? "High contrast"}</dd>
        </div>
      </dl>
    </div>
  );
}

