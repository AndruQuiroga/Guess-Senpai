"use client";

import { FormEvent, useCallback, useMemo, useRef } from "react";

import Image from "next/image";

import type { CharacterGuessEntry } from "../../../types/puzzles";
import {
  TitleGuessField,
  type TitleGuessFieldHandle,
  type TitleGuessSelection,
} from "../TitleGuessField";
import type { CharacterEntryState, FeedbackState } from "./types";

interface CharacterCardProps {
  index: number;
  roundIndex: number;
  entry: CharacterGuessEntry;
  state: CharacterEntryState;
  disabled?: boolean;
  onAnimeChange(value: string): void;
  onCharacterChange(value: string): void;
  onSubmit(selection: TitleGuessSelection, characterValue: string): void;
  onValidationError(feedback: FeedbackState): void;
}

export function CharacterCard({
  index,
  roundIndex,
  entry,
  state,
  disabled = false,
  onAnimeChange,
  onCharacterChange,
  onSubmit,
  onValidationError,
}: CharacterCardProps) {
  const guessFieldRef = useRef<TitleGuessFieldHandle | null>(null);
  const characterId = `${roundIndex}-${state.id}`;

  const attempts = state.history.length;
  const cardDisabled = disabled || state.submitting;
  const filterStyle = state.completed ? "none" : entry.reveal.filter || "none";

  const roleLabel = entry.character.role?.trim();
  const revealDescription = entry.reveal.description?.trim();

  const displayFeedback = state.feedback;

  const handleAnimeSubmit = useCallback(
    (selection: TitleGuessSelection) => {
      const trimmedCharacter = state.characterValue.trim();
      if (!trimmedCharacter) {
        onValidationError({
          type: "error",
          message: "Enter the character name before submitting.",
        });
        return;
      }
      onSubmit(selection, trimmedCharacter);
    },
    [onSubmit, onValidationError, state.characterValue],
  );

  const handleFormSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (cardDisabled) return;
      const selection = guessFieldRef.current?.submit();
      const trimmedAnime = state.animeValue.trim();
      const trimmedCharacter = state.characterValue.trim();

      if (!trimmedAnime) {
        onValidationError({
          type: "error",
          message: "Enter the anime title before submitting.",
        });
        return;
      }
      if (!trimmedCharacter) {
        onValidationError({
          type: "error",
          message: "Enter the character name before submitting.",
        });
        return;
      }
      if (!selection) {
        const fallbackSelection: TitleGuessSelection = {
          value: trimmedAnime,
        };
        onSubmit(fallbackSelection, trimmedCharacter);
        return;
      }
      onSubmit(selection, trimmedCharacter);
    },
    [
      cardDisabled,
      onSubmit,
      onValidationError,
      state.animeValue,
      state.characterValue,
    ],
  );

  const attemptsLabel = useMemo(() => {
    if (attempts === 0) return "No guesses yet";
    if (attempts === 1) return "1 attempt";
    return `${attempts} attempts`;
  }, [attempts]);

  return (
    <form
      onSubmit={handleFormSubmit}
      className="flex h-full flex-col overflow-hidden rounded-lg border border-[#686b6d] bg-[#2c2f31]  "
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#2c2f31]">
        <Image
          src={entry.character.image}
          alt={entry.character.name}
          fill
          className="object-cover transition-all duration-700"
          style={{ filter: filterStyle }}
          sizes="(max-width: 768px) 100vw, 25vw"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-black/0 to-black/30" />
        <div className="absolute inset-x-0 bottom-0 space-y-2 p-4 text-white">
          <div className="text-sm uppercase tracking-[0.28em] text-[#f4f0e7]">
            Card {index + 1}
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold leading-tight">
              {entry.reveal.label}
            </p>
            {revealDescription ? (
              <p className="text-sm text-[#f4f0e7]">{revealDescription}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        {roleLabel ? (
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-[#c1c2bd]">
            {roleLabel}
          </p>
        ) : null}

        <div className="space-y-2">
          <label
            htmlFor={`${characterId}-anime`}
            className="text-sm font-semibold text-[#f4f0e7]"
          >
            Anime
          </label>
          <TitleGuessField
            ref={guessFieldRef}
            value={state.animeValue}
            onValueChange={onAnimeChange}
            onSubmit={handleAnimeSubmit}
            ariaLabel={`Anime guess for card ${index + 1}`}
            suggestionsLabel={`Anime title suggestions for card ${index + 1}`}
            disabled={cardDisabled || state.completed}
            placeholder="Type an anime title"
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor={`${characterId}-character`}
            className="text-sm font-semibold text-[#f4f0e7]"
          >
            Character
          </label>
          <input
            id={`${characterId}-character`}
            type="text"
            value={state.characterValue}
            onChange={(event) => onCharacterChange(event.target.value)}
            disabled={cardDisabled || state.completed}
            placeholder="Enter the character name"
            className="w-full rounded-xl border border-[#686b6d] bg-[#2c2f31] px-3 py-2 text-base text-white  focus:border-[#ff7658]  focus:ring-2 focus:ring-[#ff9b83] disabled:cursor-not-allowed disabled:opacity-70"
          />
        </div>

        <div className="mt-auto space-y-3">
          <div className="flex items-center justify-between text-sm text-[#f4f0e7]">
            <span>{attemptsLabel}</span>
            {state.completed ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#1f3a2c] px-2 py-1 text-sm font-semibold text-emerald-200">
                ✓ Solved
              </span>
            ) : null}
          </div>

          {displayFeedback ? (
            <div
              className={[
                "rounded-xl border px-3 py-2 text-sm leading-snug",
                displayFeedback.type === "success"
                  ? "border-[#3f8a5f] bg-[#1f3a2c] text-emerald-100"
                  : displayFeedback.type === "partial"
                    ? "border-[#c9a13e] bg-[#3d3220] text-amber-100"
                    : "border-[#c0566a] bg-[#40242a] text-rose-100",
              ].join(" ")}
            >
              {displayFeedback.message}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={cardDisabled || state.completed}
            className="w-full rounded-xl bg-[#ff7658] px-3 py-2 text-base font-semibold text-[#27110b]  transition hover:bg-[#ff8a70]  focus:ring-2 focus:ring-brand-300 focus:ring-offset-2 focus:ring-offset-black disabled:cursor-not-allowed disabled:bg-[#383a3c]"
          >
            {state.completed
              ? "Solved"
              : state.submitting
                ? "Checking…"
                : "Submit guess"}
          </button>
        </div>
      </div>
    </form>
  );
}
