"use client";

import { useMemo } from "react";

import { PanelSection } from "../PanelSection";

export interface HistoryEntry {
  date: string;
  completed: number;
  total: number;
}

interface StreakHistoryCardProps {
  streakCount: number;
  lastCompleted?: string | null;
  history: HistoryEntry[];
}

function formatDate(dateString: string): string {
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) {
    return dateString;
  }
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function StreakHistoryCard({
  streakCount,
  lastCompleted,
  history,
}: StreakHistoryCardProps) {
  const points = useMemo(() => {
    if (!history.length) {
      return [];
    }
    const reversed = [...history].reverse();
    return reversed.slice(-14);
  }, [history]);

  const lastCompletedLabel = lastCompleted ? formatDate(lastCompleted) : "—";

  return (
    <PanelSection innerClassName="space-y-6" className="h-full">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-brand-200">
          Current streak
        </p>
        <div className="flex items-end justify-between">
          <span className="text-4xl font-display font-semibold text-[#f4f0e7]">
            {streakCount}
          </span>
          <span className="text-xs text-neutral-400">
            Last completed: {lastCompletedLabel}
          </span>
        </div>
      </header>
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-neutral-400">
          <span>Recent progress</span>
          <span>
            {points.length} day{points.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="space-y-3">
          {points.length === 0 ? (
            <p className="text-sm text-[#c1c2bd]">
              No history yet. Start solving puzzles to build a streak!
            </p>
          ) : (
            points.map((entry) => {
              const ratio =
                entry.total > 0
                  ? Math.min(entry.completed / entry.total, 1)
                  : 0;
              const percent = Math.round(ratio * 100);
              return (
                <div key={entry.date} className="space-y-1">
                  <div className="flex items-center justify-between text-[0.7rem] uppercase tracking-wide text-neutral-400">
                    <span>{formatDate(entry.date)}</span>
                    <span className="font-semibold text-[#c1c2bd]">
                      {entry.completed}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[#2c2f31]">
                    <div
                      className="h-2 rounded-full bg-[#ff7658] transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </PanelSection>
  );
}
