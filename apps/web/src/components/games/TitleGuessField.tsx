"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";

import { useTitleSuggestions } from "../../hooks/useTitleSuggestions";

export interface TitleGuessSelection {
  value: string;
  suggestionId?: number;
}

export interface TitleGuessFieldHandle {
  submit(): TitleGuessSelection | null;
  focus(): void;
  close(): void;
}

interface TitleGuessFieldProps {
  value: string;
  onValueChange(value: string): void;
  onSubmit(selection: TitleGuessSelection): void;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel: string;
  suggestionsLabel?: string;
  className?: string;
  minQueryLength?: number;
  suggestionLimit?: number;
  debounceMs?: number;
  loadingText?: string;
  emptyText?: string;
  errorText?: string;
}

export const TitleGuessField = forwardRef<
  TitleGuessFieldHandle,
  TitleGuessFieldProps
>(function TitleGuessField(
  {
    value,
    onValueChange,
    onSubmit,
    disabled = false,
    placeholder,
    ariaLabel,
    suggestionsLabel = "Title suggestions",
    className,
    minQueryLength = 2,
    suggestionLimit = 8,
    debounceMs = 300,
    loadingText = "Searching…",
    emptyText = "No matches found",
    errorText = "Couldn't load suggestions",
  },
  ref,
) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const blurTimeoutRef = useRef<number | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const listboxId = `${useId()}-title-suggestions`;
  const trimmedValue = useMemo(() => value.trim(), [value]);

  const { suggestions, loading, error } = useTitleSuggestions(
    disabled ? "" : value,
    {
      debounceMs,
      limit: suggestionLimit,
      minLength: minQueryLength,
    },
  );

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
    setHighlightedIndex(-1);
  }, []);

  const findSelection = useCallback((): TitleGuessSelection | null => {
    if (!trimmedValue) {
      return null;
    }
    const normalized = trimmedValue.toLowerCase();
    const canonical = suggestions.find(
      (item) => item.title.trim().toLowerCase() === normalized,
    );
    return {
      value: trimmedValue,
      suggestionId: canonical?.id,
    };
  }, [suggestions, trimmedValue]);

  useImperativeHandle(
    ref,
    () => ({
      submit: () => {
        const selection = findSelection();
        if (selection) {
          closeMenu();
        }
        return selection;
      },
      focus: () => {
        inputRef.current?.focus();
      },
      close: closeMenu,
    }),
    [closeMenu, findSelection],
  );

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        window.clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (disabled) {
      closeMenu();
    }
  }, [closeMenu, disabled]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [suggestions]);

  const suggestionsVisible =
    isMenuOpen && !disabled && trimmedValue.length >= minQueryLength;

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onValueChange(event.target.value);
      if (!disabled) {
        setIsMenuOpen(true);
      }
    },
    [disabled, onValueChange],
  );

  const handleFocus = useCallback(() => {
    if (blurTimeoutRef.current) {
      window.clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    if (!disabled) {
      setIsMenuOpen(true);
    }
  }, [disabled]);

  const handleBlur = useCallback(() => {
    if (blurTimeoutRef.current) {
      window.clearTimeout(blurTimeoutRef.current);
    }
    blurTimeoutRef.current = window.setTimeout(() => {
      closeMenu();
      blurTimeoutRef.current = null;
    }, 120);
  }, [closeMenu]);

  const handleSubmitSelection = useCallback(
    (selection: TitleGuessSelection) => {
      onValueChange(selection.value);
      closeMenu();
      void onSubmit(selection);
    },
    [closeMenu, onSubmit, onValueChange],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (suggestions.length === 0) {
          setHighlightedIndex(-1);
          return;
        }
        setIsMenuOpen(true);
        setHighlightedIndex((prev) => {
          const next = prev + 1;
          return next >= suggestions.length ? 0 : next;
        });
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        if (suggestions.length === 0) {
          setHighlightedIndex(-1);
          return;
        }
        setIsMenuOpen(true);
        setHighlightedIndex((prev) =>
          prev <= 0 ? suggestions.length - 1 : prev - 1,
        );
      } else if (
        event.key === "Enter" &&
        highlightedIndex >= 0 &&
        suggestions[highlightedIndex]
      ) {
        event.preventDefault();
        const suggestion = suggestions[highlightedIndex];
        handleSubmitSelection({
          value: suggestion.title.trim(),
          suggestionId: suggestion.id,
        });
      } else if (event.key === "Escape") {
        closeMenu();
      }
    },
    [
      closeMenu,
      disabled,
      handleSubmitSelection,
      highlightedIndex,
      suggestions,
    ],
  );

  return (
    <div className={className}>
      <div className="relative">
        <input
          ref={inputRef}
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-400/20 disabled:cursor-not-allowed disabled:opacity-70"
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-label={ariaLabel}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={suggestionsVisible}
          aria-controls={
            suggestionsVisible && suggestions.length > 0 ? listboxId : undefined
          }
          aria-activedescendant={
            highlightedIndex >= 0 && suggestions[highlightedIndex]
              ? `${listboxId}-option-${highlightedIndex}`
              : undefined
          }
        />
        {suggestionsVisible && (
          <div className="absolute left-0 right-0 z-20 mt-2 min-h-[12rem] overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/95 shadow-xl backdrop-blur">
            {loading ? (
              <div className="px-4 py-3 text-sm text-neutral-300">
                {loadingText}
              </div>
            ) : error ? (
              <div className="px-4 py-3 text-sm text-rose-300">
                {errorText}
              </div>
            ) : suggestions.length === 0 ? (
              <div className="px-4 py-3 text-sm text-neutral-400">
                {emptyText}
              </div>
            ) : (
              <ul
                role="listbox"
                id={listboxId}
                aria-label={suggestionsLabel}
                className="max-h-60 overflow-y-auto py-2"
              >
                {suggestions.map((suggestion, index) => {
                  const isActive = index === highlightedIndex;
                  return (
                    <li
                      key={suggestion.id}
                      id={`${listboxId}-option-${index}`}
                      role="option"
                      aria-selected={isActive}
                    >
                      <button
                        type="button"
                        className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm transition ${
                          isActive
                            ? "bg-brand-500/20 text-white"
                            : "text-neutral-200 hover:bg-white/5"
                        }`}
                        onMouseDown={(event: MouseEvent<HTMLButtonElement>) => {
                          event.preventDefault();
                          if (disabled) return;
                          handleSubmitSelection({
                            value: suggestion.title.trim(),
                            suggestionId: suggestion.id,
                          });
                        }}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        onFocus={() => setHighlightedIndex(index)}
                      >
                        <span>{suggestion.title}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

