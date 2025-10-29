import { useCallback, useEffect, useMemo, useState } from "react";

import type { GameProgress, GameRoundProgress } from "../../../types/progress";
import type { CharacterGuessRound } from "../../../types/puzzles";
import {
  CharacterEntryState,
  CharacterGuessHistoryEntry,
  CharacterGuessResult,
  CharacterRoundState,
  FeedbackState,
  UseCharacterSilhouetteGameOptions,
  UseCharacterSilhouetteGameResult,
} from "./types";

interface StoredGuessRecord {
  round?: number;
  entryId?: number;
  entryIndex?: number;
  anime?: string;
  character?: string;
  animeMatch?: boolean;
  characterMatch?: boolean | null;
  resolvedAnime?: string | null;
  resolvedCharacter?: string | null;
  completed?: boolean;
  timestamp?: number;
}

function clampIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(total - 1, index));
}

function safeRounds(rounds: CharacterGuessRound[]): CharacterGuessRound[] {
  if (!Array.isArray(rounds) || rounds.length === 0) {
    return [
      {
        order: 1,
        difficulty: 1,
        entries: [],
      },
    ];
  }
  return rounds;
}

function parseStoredGuess(value: string | undefined): StoredGuessRecord | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as StoredGuessRecord;
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch (error) {
    // ignore malformed records
  }
  return null;
}

function collectStoredGuesses(progress?: GameProgress): StoredGuessRecord[] {
  if (!progress) return [];
  const records: StoredGuessRecord[] = [];
  const append = (value: string | undefined) => {
    const record = parseStoredGuess(value);
    if (record) {
      records.push(record);
    }
  };

  progress.guesses?.forEach((guess) => append(guess));
  progress.rounds?.forEach((round) => {
    round.guesses?.forEach((guess) => append(guess));
  });
  return records;
}

function createHistoryFromRecords(
  records: StoredGuessRecord[],
  roundIndex: number,
  entryId: number,
  fallbackIndex: number,
): CharacterGuessHistoryEntry[] {
  return records
    .filter((record) => {
      const matchesRound = (record.round ?? roundIndex + 1) === roundIndex + 1;
      const matchesEntry =
        record.entryId === entryId ||
        (typeof record.entryId !== "number" && record.entryIndex === fallbackIndex);
      return matchesRound && matchesEntry;
    })
    .map((record) => ({
      anime: record.anime ?? "",
      character: record.character ?? "",
      animeMatch: Boolean(record.animeMatch),
      characterMatch:
        typeof record.characterMatch === "boolean"
          ? record.characterMatch
          : record.characterMatch === null
            ? null
            : null,
      timestamp:
        typeof record.timestamp === "number"
          ? record.timestamp
          : Date.now(),
    }));
}

function resolveStoredValue<T>(
  records: StoredGuessRecord[],
  roundIndex: number,
  entryId: number,
  fallbackIndex: number,
  extractor: (record: StoredGuessRecord) => T | undefined,
): T | undefined {
  for (const record of records) {
    const matchesRound = (record.round ?? roundIndex + 1) === roundIndex + 1;
    const matchesEntry =
      record.entryId === entryId ||
      (typeof record.entryId !== "number" && record.entryIndex === fallbackIndex);
    if (!matchesRound || !matchesEntry) continue;
    const value = extractor(record);
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
}

function createInitialRoundStates(
  rounds: CharacterGuessRound[],
  initialProgress?: GameProgress,
): CharacterRoundState[] {
  const normalizedRounds = safeRounds(rounds);
  const records = collectStoredGuesses(initialProgress);

  return normalizedRounds.map((round, roundIndex) => {
    const entries: CharacterEntryState[] = round.entries.map((entry, entryIndex) => {
      const characterId = entry.character?.id ?? entryIndex;
      const history = createHistoryFromRecords(records, roundIndex, characterId, entryIndex);
      const animeMatchPreviously = history.some((item) => item.animeMatch);
      const characterMatchPreviously = history.some(
        (item) => item.characterMatch === true,
      );

      const storedAnime = resolveStoredValue(
        records,
        roundIndex,
        characterId,
        entryIndex,
        (record) => record.resolvedAnime,
      );
      const resolvedAnimeSource =
        typeof storedAnime === "string" && storedAnime.trim().length > 0
          ? storedAnime
          : animeMatchPreviously
            ? history.find((item) => item.animeMatch)?.anime ?? null
            : null;
      const resolvedAnime =
        typeof resolvedAnimeSource === "string" && resolvedAnimeSource.trim().length > 0
          ? resolvedAnimeSource.trim()
          : null;

      const storedCharacter = resolveStoredValue(
        records,
        roundIndex,
        characterId,
        entryIndex,
        (record) => record.resolvedCharacter,
      );
      const resolvedCharacterSource =
        typeof storedCharacter === "string" && storedCharacter.trim().length > 0
          ? storedCharacter
          : characterMatchPreviously
            ? history.find((item) => item.characterMatch)?.character ?? null
            : null;
      const resolvedCharacter =
        typeof resolvedCharacterSource === "string" && resolvedCharacterSource.trim().length > 0
          ? resolvedCharacterSource.trim()
          : null;

      const completedViaRecords = resolveStoredValue(
        records,
        roundIndex,
        characterId,
        entryIndex,
        (record) => record.completed,
      );

      const forceComplete = Boolean(initialProgress?.completed);
      const completed =
        Boolean(completedViaRecords) || (animeMatchPreviously && characterMatchPreviously) || forceComplete;

      const defaultAnime = completed
        ? resolvedAnime ?? entry.animeAnswer
        : resolvedAnime ?? (animeMatchPreviously ? history.find((item) => item.animeMatch)?.anime ?? "" : "");
      const defaultCharacter = completed
        ? resolvedCharacter ?? entry.characterAnswer
        : resolvedCharacter ?? (characterMatchPreviously ? history.find((item) => item.characterMatch)?.character ?? "" : "");

      const feedback: FeedbackState = completed
        ? {
            type: "success",
            message: `${entry.characterAnswer} revealed!`,
          }
        : null;

      return {
        id: `${roundIndex + 1}-${characterId}-${entryIndex}`,
        characterId,
        animeValue: defaultAnime ?? "",
        characterValue: defaultCharacter ?? "",
        history,
        resolvedAnime: defaultAnime && defaultAnime.trim().length > 0 ? defaultAnime : null,
        resolvedCharacter:
          defaultCharacter && defaultCharacter.trim().length > 0 ? defaultCharacter : null,
        completed,
        animeLocked: completed || animeMatchPreviously,
        feedback,
        submitting: false,
      };
    });

    const allCompleted = entries.length > 0 && entries.every((entry) => entry.completed);
    const label = round.entries[0]?.reveal?.label ?? `Round ${roundIndex + 1}`;
    const description = round.entries[0]?.reveal?.description ?? null;

    return {
      order: round.order,
      difficulty: round.difficulty,
      label,
      description,
      entries,
      completed: allCompleted,
    };
  });
}

function encodeGuessRecord(
  roundIndex: number,
  entry: CharacterEntryState,
  history: CharacterGuessHistoryEntry,
): string {
  return JSON.stringify({
    round: roundIndex + 1,
    entryId: entry.characterId,
    anime: history.anime,
    character: history.character,
    animeMatch: history.animeMatch,
    characterMatch: history.characterMatch,
    resolvedAnime: entry.resolvedAnime ?? undefined,
    resolvedCharacter: entry.resolvedCharacter ?? undefined,
    completed: entry.completed,
    timestamp: history.timestamp,
  });
}

function buildProgress(
  rounds: CharacterRoundState[],
  activeRoundIndex: number,
): GameProgress {
  const totalRounds = rounds.length > 0 ? rounds.length : 1;
  const completed = rounds.every((round) => round.entries.length === 0 || round.completed);
  let highestCompletedRound = 0;
  rounds.forEach((round, index) => {
    if (round.completed) {
      highestCompletedRound = index + 1;
    }
  });

  const inferredRound = completed
    ? totalRounds
    : Math.max(activeRoundIndex + 1, highestCompletedRound + 1, 1);

  const guesses = rounds.flatMap((round, roundIndex) =>
    round.entries.flatMap((entry) =>
      entry.history.map((history) => encodeGuessRecord(roundIndex, entry, history)),
    ),
  );

  const roundsProgress: GameRoundProgress[] = rounds.map((round, roundIndex) => {
    const roundGuesses = round.entries.flatMap((entry) =>
      entry.history.map((history) => encodeGuessRecord(roundIndex, entry, history)),
    );
    const solvedCount = round.entries.filter((entry) => entry.completed).length;
    const resolvedEntry = round.entries.find((entry) => entry.resolvedAnime);
    return {
      round: roundIndex + 1,
      guesses: roundGuesses,
      completed: round.completed,
      stage: solvedCount,
      resolvedAnswer: resolvedEntry?.resolvedAnime ?? undefined,
    };
  });

  return {
    completed,
    round: inferredRound,
    guesses,
    rounds: roundsProgress,
  };
}

export function useCharacterSilhouetteGame({
  rounds,
  initialProgress,
}: UseCharacterSilhouetteGameOptions): UseCharacterSilhouetteGameResult {
  const normalizedRounds = safeRounds(rounds);
  const totalRounds = normalizedRounds.length;
  const initialRoundIndex = clampIndex(
    (initialProgress?.round ?? 1) - 1,
    totalRounds,
  );

  const [roundStates, setRoundStates] = useState<CharacterRoundState[]>(() =>
    createInitialRoundStates(normalizedRounds, initialProgress),
  );
  const [activeRoundIndex, setActiveRoundIndex] = useState(initialRoundIndex);
  const [summaryRoundIndex, setSummaryRoundIndex] = useState<number | null>(null);

  useEffect(() => {
    setRoundStates(createInitialRoundStates(normalizedRounds, initialProgress));
    setActiveRoundIndex(clampIndex((initialProgress?.round ?? 1) - 1, totalRounds));
    setSummaryRoundIndex(null);
  }, [initialProgress, normalizedRounds, totalRounds]);

  const totalEntries = useMemo(
    () => roundStates.reduce((sum, round) => sum + round.entries.length, 0),
    [roundStates],
  );

  const totalSolved = useMemo(
    () =>
      roundStates.reduce(
        (sum, round) => sum + round.entries.filter((entry) => entry.completed).length,
        0,
      ),
    [roundStates],
  );

  const completed = useMemo(
    () => roundStates.every((round) => round.entries.length === 0 || round.completed),
    [roundStates],
  );

  const progress = useMemo(
    () => buildProgress(roundStates, activeRoundIndex),
    [roundStates, activeRoundIndex],
  );

  const updateEntryValue = useCallback(
    (roundIndex: number, entryIndex: number, field: "anime" | "character", value: string) => {
      setRoundStates((prev) =>
        prev.map((round, rIndex) => {
          if (rIndex !== roundIndex) return round;
          const entries = round.entries.map((entry, eIndex) => {
            if (eIndex !== entryIndex) return entry;
            return {
              ...entry,
              animeValue: field === "anime" ? value : entry.animeValue,
              characterValue: field === "character" ? value : entry.characterValue,
              feedback: null,
            };
          });
          return { ...round, entries };
        }),
      );
    },
    [],
  );

  const setEntrySubmitting = useCallback(
    (roundIndex: number, entryIndex: number, submittingValue: boolean) => {
      setRoundStates((prev) =>
        prev.map((round, rIndex) => {
          if (rIndex !== roundIndex) return round;
          const entries = round.entries.map((entry, eIndex) =>
            eIndex === entryIndex ? { ...entry, submitting: submittingValue } : entry,
          );
          return { ...round, entries };
        }),
      );
    },
    [],
  );

  const setEntryFeedback = useCallback(
    (roundIndex: number, entryIndex: number, feedback: FeedbackState) => {
      setRoundStates((prev) =>
        prev.map((round, rIndex) => {
          if (rIndex !== roundIndex) return round;
          const entries = round.entries.map((entry, eIndex) =>
            eIndex === entryIndex ? { ...entry, feedback } : entry,
          );
          return { ...round, entries };
        }),
      );
    },
    [],
  );

  const applyGuessResult = useCallback(
    (roundIndex: number, entryIndex: number, result: CharacterGuessResult) => {
      let completedRound = -1;
      setRoundStates((prev) =>
        prev.map((round, rIndex) => {
          if (rIndex !== roundIndex) return round;
          const entries = round.entries.map((entry, eIndex) => {
            if (eIndex !== entryIndex) return entry;

            const timestamp = Date.now();
            const historyEntry: CharacterGuessHistoryEntry = {
              anime: result.anime,
              character: result.character,
              animeMatch: result.animeMatch,
              characterMatch: result.characterMatch,
              timestamp,
            };
            const history = [...entry.history, historyEntry];

            const resolvedAnime = result.animeMatch
              ? result.resolvedAnime ?? entry.resolvedAnime ?? result.anime
              : entry.resolvedAnime;
            const resolvedCharacter =
              result.characterMatch === true
                ? result.resolvedCharacter ?? entry.resolvedCharacter ?? result.character
                : entry.resolvedCharacter;

            const animeLocked = entry.animeLocked || result.animeMatch;
            const solved =
              (entry.completed || animeLocked || Boolean(resolvedAnime)) &&
              (result.characterMatch === true || entry.completed);

            let feedback: FeedbackState = null;
            if (result.animeMatch && result.characterMatch === true) {
              feedback = {
                type: "success",
                message:
                  resolvedCharacter && resolvedAnime
                    ? `${resolvedCharacter} from ${resolvedAnime}!`
                    : "Character revealed!",
              };
            } else if (result.animeMatch) {
              feedback = {
                type: "partial",
                message: "Anime locked in! Name the character to finish the card.",
              };
            } else {
              feedback = {
                type: "error",
                message: "No match yet. Adjust your guesses and try again.",
              };
            }

            return {
              ...entry,
              history,
              resolvedAnime,
              resolvedCharacter,
              animeLocked,
              completed: solved && (result.characterMatch === true || entry.completed),
              animeValue:
                solved && resolvedAnime ? resolvedAnime : animeLocked ? entry.animeValue || result.anime : entry.animeValue,
              characterValue:
                result.characterMatch === true && resolvedCharacter
                  ? resolvedCharacter
                  : entry.characterValue,
              feedback,
              submitting: false,
            };
          });

          const roundCompleted = entries.length > 0 && entries.every((entry) => entry.completed);
          if (!round.completed && roundCompleted) {
            completedRound = rIndex;
          }

          return {
            ...round,
            entries,
            completed: roundCompleted,
          };
        }),
      );

      if (completedRound >= 0) {
        setSummaryRoundIndex((current) => (current === null ? completedRound : current));
      }
    },
    [],
  );

  const handleSetActiveRoundIndex = useCallback(
    (index: number) => {
      setActiveRoundIndex((prev) => {
        const next = clampIndex(index, totalRounds);
        return next === prev ? prev : next;
      });
    },
    [totalRounds],
  );

  return {
    rounds: roundStates,
    activeRoundIndex,
    setActiveRoundIndex: handleSetActiveRoundIndex,
    totalEntries,
    totalSolved,
    completed,
    progress,
    summaryRoundIndex,
    setSummaryRoundIndex,
    updateEntryValue,
    setEntrySubmitting,
    setEntryFeedback,
    applyGuessResult,
  };
}

