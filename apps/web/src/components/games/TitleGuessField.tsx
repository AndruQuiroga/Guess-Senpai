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
} from "react";

import {
  useTitleSuggestions,
  type SuggestionSource,
} from "../../hooks/useTitleSuggestions";

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
  id?: string;
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
  /** Search anime titles (default) or character names. */
  source?: SuggestionSource;
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
    id,
    onValueChange,
    onSubmit,
    disabled = false,
    placeholder,
    ariaLabel,
    suggestionsLabel = "Title suggestions",
    className,
    minQueryLength = 2,
    suggestionLimit = 8,
    source = "titles",
    debounceMs = 300,
    loadingText = "Searching…",
    emptyText = "No matches found",
    errorText = "Couldn't load suggestions",
  },
  ref,
) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  /** The suggestion last picked, so its id survives a re-search of its title. */
  const pickedRef = useRef<TitleGuessSelection | null>(null);

  const listboxId = `${useId()}-title-suggestions`;
  const trimmedValue = useMemo(() => value.trim(), [value]);

  const { suggestions, loading, error } = useTitleSuggestions(
    disabled ? "" : value,
    {
      debounceMs,
      source,
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
    const picked = pickedRef.current;
    if (picked && picked.value.trim().toLowerCase() === normalized) {
      return { value: trimmedValue, suggestionId: picked.suggestionId };
    }
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
    if (!disabled) {
      setIsMenuOpen(true);
    }
  }, [disabled]);

  const handleBlur = useCallback(() => closeMenu(), [closeMenu]);

  const handleSubmitSelection = useCallback(
    (selection: TitleGuessSelection) => {
      pickedRef.current = selection;
      onValueChange(selection.value);
      closeMenu();
      inputRef.current?.focus();
    },
    [closeMenu, onValueChange],
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
      } else if (event.key === "Enter") {
        event.preventDefault();
        const selection = findSelection();
        if (selection) onSubmit(selection);
      } else if (event.key === "Escape") {
        closeMenu();
      }
    },
    [
      closeMenu,
      disabled,
      handleSubmitSelection,
      findSelection,
      highlightedIndex,
      onSubmit,
      suggestions,
    ],
  );

  return (
    <div className={className}>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          className="w-full rounded-md border border-line-strong bg-ink px-4 py-3 text-base text-paper outline-none transition focus:border-signal-text focus:ring-2 focus:ring-signal/30 disabled:cursor-not-allowed disabled:opacity-70"
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
          <div className="absolute left-0 right-0 z-20 mt-2 max-h-[min(18rem,45dvh)] overflow-hidden rounded-md border border-line-strong bg-panel">
            {loading ? (
              <div className="px-4 py-3 text-sm text-muted">{loadingText}</div>
            ) : error ? (
              <div className="px-4 py-3 text-sm text-danger">{errorText}</div>
            ) : suggestions.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted">{emptyText}</div>
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
                      // Keep focus in the input: a blur here would close the
                      // menu before the click lands and drop the selection.
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        if (disabled) return;
                        handleSubmitSelection({
                          value: suggestion.title.trim(),
                          suggestionId: suggestion.id,
                        });
                      }}
                      onMouseEnter={() => setHighlightedIndex(index)}
                    >
                      <div
                        className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm transition ${
                          isActive
                            ? "bg-hover text-paper"
                            : "text-muted hover:bg-panel-raised"
                        }`}
                      >
                        <span>{suggestion.title}</span>
                      </div>
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
