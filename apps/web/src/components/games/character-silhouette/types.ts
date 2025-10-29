import type { CharacterGuessRound } from "../../../types/puzzles";
import type { GameProgress } from "../../../types/progress";

export interface CharacterGuessHistoryEntry {
  anime: string;
  character: string;
  animeMatch: boolean;
  characterMatch: boolean | null;
  timestamp: number;
}

export interface CharacterEntryState {
  id: string;
  characterId: number;
  animeValue: string;
  characterValue: string;
  history: CharacterGuessHistoryEntry[];
  resolvedAnime?: string | null;
  resolvedCharacter?: string | null;
  completed: boolean;
  animeLocked: boolean;
  feedback: FeedbackState;
  submitting: boolean;
}

export interface CharacterRoundState {
  order: number;
  difficulty: number;
  label: string;
  description?: string | null;
  entries: CharacterEntryState[];
  completed: boolean;
}

export type FeedbackState =
  | { type: "success"; message: string }
  | { type: "partial"; message: string }
  | { type: "error"; message: string }
  | null;

export interface UseCharacterSilhouetteGameResult {
  rounds: CharacterRoundState[];
  activeRoundIndex: number;
  setActiveRoundIndex(index: number): void;
  totalEntries: number;
  totalSolved: number;
  completed: boolean;
  progress: GameProgress;
  summaryRoundIndex: number | null;
  setSummaryRoundIndex(index: number | null): void;
  updateEntryValue(
    roundIndex: number,
    entryIndex: number,
    field: "anime" | "character",
    value: string,
  ): void;
  setEntrySubmitting(roundIndex: number, entryIndex: number, submitting: boolean): void;
  setEntryFeedback(
    roundIndex: number,
    entryIndex: number,
    feedback: FeedbackState,
  ): void;
  applyGuessResult(
    roundIndex: number,
    entryIndex: number,
    result: CharacterGuessResult,
  ): void;
}

export interface CharacterGuessResult {
  anime: string;
  character: string;
  animeMatch: boolean;
  characterMatch: boolean | null;
  resolvedAnime?: string | null;
  resolvedCharacter?: string | null;
}

export interface UseCharacterSilhouetteGameOptions {
  rounds: CharacterGuessRound[];
  initialProgress?: GameProgress;
}
