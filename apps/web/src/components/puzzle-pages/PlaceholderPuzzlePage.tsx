"use client";

import { ReactNode } from "react";

import { GameUnavailable } from "../GameUnavailable";
import type { DailyProgress } from "../../types/progress";

interface Props {
  title: string;
  /** Kept for existing callers; no longer used. */
  slug?: string;
  /** Kept for existing callers; no longer used. */
  description?: ReactNode;
  /** Kept for existing callers; no longer used. */
  dailyProgress?: DailyProgress;
}

/** Shown when a mode has no playable puzzle today (friendly, not a crash). */
export function PlaceholderPuzzlePage({ title }: Props) {
  return <GameUnavailable title={title} />;
}
