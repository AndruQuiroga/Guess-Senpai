"use client";

import { FormEvent, useCallback, useMemo, useRef } from "react";

import Image from "next/image";

import type { CharacterGuessEntry } from "../../../types/puzzles";
import { TitleGuessField, type TitleGuessFieldHandle, type TitleGuessSelection } from "../TitleGuessField";
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
    [cardDisabled, onSubmit, onValidationError, state.animeValue, state.characterValue],
  );

  const attemptsLabel = useMemo(() => {
    if (attempts === 0) return "No guesses yet";
    if (attempts === 1) return "1 attempt";
    return `${attempts} attempts`;
  }, [attempts]);

  return (
    <form
      onSubmit={handleFormSubmit}
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/4 shadow-[0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-lg"
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-white/5">
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
          <div className="text-xs uppercase tracking-[0.28em] text-white/80">
            Card {index + 1}
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold leading-tight">
              {entry.reveal.label}
            </p>
            {revealDescription ? (
              <p className="text-xs text-white/80">{revealDescription}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        {roleLabel ? (
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-brand-200/80">
            {roleLabel}
          </p>
        ) : null}

        <div className="space-y-2">
          <label htmlFor={`${characterId}-anime`} className="text-xs font-semibold text-white/80">
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
            className="text-xs font-semibold text-white/80"
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
            className="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2 text-sm text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] focus:border-brand-400/70 focus:outline-none focus:ring-2 focus:ring-brand-400/30 disabled:cursor-not-allowed disabled:opacity-70"
          />
        </div>

        <div className="mt-auto space-y-3">
          <div className="flex items-center justify-between text-xs text-white/70">
            <span>{attemptsLabel}</span>
            {state.completed ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-1 text-[0.65rem] font-semibold text-emerald-200">
                ✓ Solved
              </span>
            ) : null}
          </div>

          {displayFeedback ? (
            <div
              className={[
                "rounded-xl border px-3 py-2 text-xs leading-snug",
                displayFeedback.type === "success"
                  ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-100"
                  : displayFeedback.type === "partial"
                    ? "border-amber-300/60 bg-amber-500/15 text-amber-100"
                    : "border-rose-400/60 bg-rose-500/15 text-rose-100",
              ].join(" ")}
            >
              {displayFeedback.message}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={cardDisabled || state.completed}
            className="w-full rounded-xl bg-brand-500 px-3 py-2 text-sm font-semibold text-white shadow-[0_6px_18px_rgba(59,130,246,0.35)] transition hover:bg-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:ring-offset-2 focus:ring-offset-black disabled:cursor-not-allowed disabled:bg-white/20"
          >
            {state.completed ? "Solved" : state.submitting ? "Checking…" : "Submit guess"}
          </button>
        </div>
      </div>
    </form>
  );
}

