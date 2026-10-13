"use client";

import { useMemo } from "react";

export interface DifficultyPresetOption {
  value: number;
  label: string;
  description: string;
}

interface DifficultyPresetSelectorProps {
  title: string;
  description?: string;
  presets: DifficultyPresetOption[];
  selected?: number;
  recommended?: number;
  /** Preset used when nothing is saved; shown as active with a "Default" tag. */
  defaultValue?: number;
  /** Hides the active state while the saved value is still loading. */
  loading?: boolean;
  onSelect(value: number): void;
}

export function DifficultyPresetSelector({
  title,
  description,
  presets,
  selected,
  recommended,
  defaultValue,
  loading = false,
  onSelect,
}: DifficultyPresetSelectorProps) {
  const hasSelection =
    typeof selected === "number" && Number.isFinite(selected);
  const highlightValue = useMemo(() => {
    if (loading) {
      return null;
    }
    if (typeof selected === "number" && Number.isFinite(selected)) {
      return selected;
    }
    if (typeof defaultValue === "number" && Number.isFinite(defaultValue)) {
      return defaultValue;
    }
    if (typeof recommended === "number" && Number.isFinite(recommended)) {
      return recommended;
    }
    return null;
  }, [defaultValue, loading, recommended, selected]);

  const recommendedLabel = useMemo(() => {
    if (typeof recommended !== "number" || !Number.isFinite(recommended)) {
      return null;
    }
    const preset = presets.find((item) => item.value === recommended);
    return preset?.label ?? `Preset ${recommended}`;
  }, [presets, recommended]);

  return (
    <section className="relative overflow-hidden rounded-lg border border-line bg-surface-raised p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold tracking-tight text-paper sm:text-xl">
            {title}
          </h3>
          {description ? (
            <p className="text-sm leading-relaxed text-muted">{description}</p>
          ) : null}
        </div>
        {recommendedLabel ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-signal bg-signal-soft px-3 py-1 text-xs font-semibold uppercase tracking-[0.32em] text-paper">
            ☆ Suggested: {recommendedLabel}
          </span>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {presets.map((preset) => {
          const isActive = highlightValue === preset.value;
          const isSelected = !loading && selected === preset.value;
          const isDefault =
            !loading && !hasSelection && defaultValue === preset.value;
          const isSuggested = recommended === preset.value;
          return (
            <button
              key={preset.value}
              type="button"
              onClick={() => onSelect(preset.value)}
              className={`group relative overflow-hidden rounded-lg border border-line-strong bg-panel p-4 text-left transition hover:border-line-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80 ${
                isActive ? "border-signal bg-signal-soft" : ""
              }`}
              aria-pressed={isSelected || isDefault}
            >
              <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-20" />
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-base font-semibold text-paper">
                  {preset.label}
                </h4>
                {isSelected ? (
                  <span className="text-sm text-paper">Selected</span>
                ) : isDefault ? (
                  <span className="text-sm text-paper">Default</span>
                ) : isSuggested ? (
                  <span className="text-xs uppercase tracking-[0.28em] text-signal-text">
                    Suggested
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {preset.description}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
