"use client";

import { useCallback, useMemo } from "react";

import { useUserPreferences } from "../../hooks/useUserPreferences";
import { DifficultyPresetSelector, type DifficultyPresetOption } from "../preferences/DifficultyPresetSelector";

const PROFILE_DIFFICULTY_PRESETS: DifficultyPresetOption[] = [
  {
    value: 1,
    label: "Relaxed",
    description: "Start each puzzle with extra context and the gentlest hint cadence.",
  },
  {
    value: 2,
    label: "Balanced",
    description: "Stick with the default challenge tuned for a mix of guidance and mystery.",
  },
  {
    value: 3,
    label: "Hardcore",
    description: "Jump straight to late-round clues and rely on instinct over hand-holding.",
  },
];

export function DifficultyPreferenceCard() {
  const { difficultyLevel, updateDifficulty, loading, error } = useUserPreferences();

  const description = useMemo(() => {
    if (error) {
      return "We couldn't load your saved difficulty. Try again in a bit.";
    }
    if (loading) {
      return "Loading your saved preference…";
    }
    return "Choose the default difficulty that determines how many hints are unlocked when you start a puzzle.";
  }, [error, loading]);

  const handleSelect = useCallback(
    (value: number) => {
      if (error) {
        return;
      }
      updateDifficulty(value);
    },
    [error, updateDifficulty],
  );

  return (
    <DifficultyPresetSelector
      title="Default puzzle difficulty"
      description={description}
      presets={PROFILE_DIFFICULTY_PRESETS}
      selected={difficultyLevel ?? undefined}
      onSelect={handleSelect}
    />
  );
}
