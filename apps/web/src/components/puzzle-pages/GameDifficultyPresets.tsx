"use client";

import { useMemo } from "react";

export interface DifficultyPreset {
  value: number;
  label: string;
  description: string;
}

interface GameDifficultyPresetsProps {
  title: string;
  description?: string;
  presets: DifficultyPreset[];
  selected?: number;
  recommended?: number;
  onSelect(value: number): void;
}

export function GameDifficultyPresets({
  title,
  description,
  presets,
  selected,
  recommended,
  onSelect,
}: GameDifficultyPresetsProps) {
  const highlightValue = useMemo(() => {
    if (typeof selected === "number" && Number.isFinite(selected)) {
      return selected;
    }
    if (typeof recommended === "number" && Number.isFinite(recommended)) {
      return recommended;
    }
    return presets[0]?.value ?? null;
  }, [presets, recommended, selected]);

  const recommendedLabel = useMemo(() => {
    if (typeof recommended !== "number" || !Number.isFinite(recommended)) {
      return null;
    }
    const preset = presets.find((item) => item.value === recommended);
    return preset?.label ?? `Preset ${recommended}`;
  }, [presets, recommended]);

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-surface-raised p-6 shadow-ambient backdrop-blur-2xl">
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-brand-400/60 to-transparent" />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold tracking-tight text-white sm:text-xl">{title}</h3>
          {description ? (
            <p className="text-sm leading-relaxed text-neutral-300/90">{description}</p>
          ) : null}
        </div>
        {recommendedLabel ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-400/40 bg-brand-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.32em] text-brand-100">
            ☆ Suggested: {recommendedLabel}
          </span>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {presets.map((preset) => {
          const isActive = highlightValue === preset.value;
          const isSelected = selected === preset.value;
          const isSuggested = recommended === preset.value;
          return (
            <button
              key={preset.value}
              type="button"
              onClick={() => onSelect(preset.value)}
              className={`group relative overflow-hidden rounded-2xl border border-white/12 bg-white/5 p-4 text-left transition hover:border-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80 ${
                isActive ? "border-brand-400/60 bg-brand-500/10 shadow-glow" : ""
              }`}
              aria-pressed={isSelected}
            >
              <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-20" />
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-base font-semibold text-white">{preset.label}</h4>
                {isSelected ? (
                  <span className="text-sm text-brand-100">Selected</span>
                ) : isSuggested ? (
                  <span className="text-xs uppercase tracking-[0.28em] text-brand-200">Suggested</span>
                ) : null}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-neutral-200/90">{preset.description}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
