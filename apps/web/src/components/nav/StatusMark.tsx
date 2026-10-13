import { GAME_STATUS_TEXT, type GameStatus } from "../../utils/gameAction";

const GLYPH: Record<GameStatus, string> = {
  new: "○",
  "in-progress": "◐",
  solved: "✓",
  "out-of-guesses": "✕",
};

const TONE: Record<GameStatus, string> = {
  new: "text-muted",
  "in-progress": "text-signal",
  solved: "text-correct",
  "out-of-guesses": "text-wrong-ink",
};

/** Glyph plus text; colour only reinforces the label. */
export function StatusMark({
  status,
  className = "",
}: {
  status: GameStatus;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-sm font-medium ${TONE[status]} ${className}`.trim()}
    >
      <span aria-hidden="true">{GLYPH[status]}</span>
      <span>{GAME_STATUS_TEXT[status]}</span>
    </span>
  );
}
