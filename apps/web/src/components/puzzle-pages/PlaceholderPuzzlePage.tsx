"use client";

import { GameUnavailable } from "../GameUnavailable";

interface Props {
  title: string;
}

/** Shown when a mode has no playable puzzle today (friendly, not a crash). */
export function PlaceholderPuzzlePage({ title }: Props) {
  return <GameUnavailable title={title} />;
}
