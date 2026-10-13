"use client";

import { useEffect, useRef, type FormEvent, type RefObject } from "react";

import {
  TitleGuessField,
  type TitleGuessFieldHandle,
  type TitleGuessSelection,
} from "../games/TitleGuessField";

interface GuessInputProps {
  value: string;
  onValueChange(value: string): void;
  fieldRef: RefObject<TitleGuessFieldHandle>;
  submitting: boolean;
  onSubmit(event: FormEvent<HTMLFormElement>): void;
  onFieldSubmit(selection: TitleGuessSelection): void;
  /** Shows the short "Enter a first guess to start" prompt above the field. */
  showPrompt?: boolean;
  error?: string | null;
}

export function GuessInput({
  value,
  onValueChange,
  fieldRef,
  submitting,
  onSubmit,
  onFieldSubmit,
  showPrompt = false,
  error,
}: GuessInputProps) {
  const wasSubmitting = useRef(false);
  useEffect(() => {
    // Keep the keyboard flow going: refocus once a guess has been processed.
    if (wasSubmitting.current && !submitting) fieldRef.current?.focus();
    wasSubmitting.current = submitting;
  }, [fieldRef, submitting]);

  return (
    <div className="space-y-2">
      {showPrompt ? (
        <p className="text-lg font-semibold text-paper">
          Enter a first guess to start
        </p>
      ) : null}
      <form onSubmit={onSubmit} className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <TitleGuessField
            ref={fieldRef}
            id="anidle-answer"
            className="w-full"
            value={value}
            onValueChange={onValueChange}
            onSubmit={onFieldSubmit}
            disabled={submitting}
            placeholder="Type an anime title…"
            ariaLabel="Anidle guess"
            suggestionsLabel="Anidle title suggestions"
          />
        </div>
        <button
          type="submit"
          aria-label="Submit Guess"
          className="button button-primary shrink-0 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={submitting}
        >
          {submitting ? "Checking…" : "Guess"}
        </button>
      </form>
      <div aria-live="polite">
        {error ? (
          <p className="rounded-md border border-danger bg-danger-soft px-3 py-2 text-sm text-danger-ink">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
