"use client";

import {
  eachDayOfInterval,
  endOfWeek,
  format,
  parseISO,
  startOfWeek,
  subDays,
  subWeeks,
  differenceInCalendarDays,
} from "date-fns";
import { useMemo } from "react";

import { STREAK_MILESTONES } from "../config/streak";
import { useStreak } from "../hooks/useStreak";

interface Props {
  currentDateIso: string;
  completed: boolean;
  className?: string;
  weeks?: number;
}

interface DayCell {
  iso: string;
  label: string;
  level: number;
  isToday: boolean;
  isSolved: boolean;
}

interface WeekColumn {
  key: string;
  days: DayCell[];
}

const DEFAULT_WEEKS = 12;
const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function classNames(...values: Array<string | null | undefined | false>): string {
  return values.filter(Boolean).join(" ");
}

function safeParseIso(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  try {
    const parsed = parseISO(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function toIso(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export default function StreakWidget({
  currentDateIso,
  completed,
  className,
  weeks = DEFAULT_WEEKS,
}: Props) {
  const streak = useStreak(currentDateIso, completed);
  const streakCount = streak.count;
  const lastCompletedIso = streak.lastCompleted ?? (completed ? currentDateIso : null);

  const currentDate = safeParseIso(currentDateIso) ?? new Date();
  const lastCompletedDate = safeParseIso(lastCompletedIso);
  const anchorDate = lastCompletedDate ?? currentDate;

  const solvedDates = useMemo(() => {
    if (!lastCompletedDate || streakCount <= 0) {
      return new Set<string>();
    }
    const entries = new Set<string>();
    for (let index = 0; index < streakCount; index += 1) {
      const solvedDay = subDays(lastCompletedDate, index);
      entries.add(toIso(solvedDay));
    }
    return entries;
  }, [lastCompletedDate, streakCount]);

  const weekColumns = useMemo<WeekColumn[]>(() => {
    const totalWeeks = Math.max(weeks, 1);
    const start = startOfWeek(subWeeks(anchorDate, totalWeeks - 1), {
      weekStartsOn: 0,
    });
    const end = endOfWeek(anchorDate, { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start, end });
    const map = new Map<string, WeekColumn>();

    for (const day of days) {
      const weekStart = startOfWeek(day, { weekStartsOn: 0 });
      const key = toIso(weekStart);
      if (!map.has(key)) {
        map.set(key, { key, days: [] });
      }
      const entry = map.get(key)!;
      const iso = toIso(day);
      const solved = solvedDates.has(iso);
      const recency = lastCompletedDate
        ? differenceInCalendarDays(lastCompletedDate, day)
        : Number.POSITIVE_INFINITY;
      let level = 0;
      if (solved && recency >= 0) {
        if (recency === 0) {
          level = 4;
        } else if (recency <= 2) {
          level = 3;
        } else if (recency <= 6) {
          level = 2;
        } else {
          level = 1;
        }
      }
      entry.days.push({
        iso,
        label: format(day, "MMM d, yyyy"),
        level,
        isToday: iso === currentDateIso,
        isSolved: solved,
      });
    }

    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [anchorDate, currentDateIso, lastCompletedDate, solvedDates, weeks]);

  const upcomingMilestone = useMemo(() => {
    return (
      STREAK_MILESTONES.find((milestone) => milestone.threshold > streakCount) ??
      null
    );
  }, [streakCount]);

  const daysRemaining = useMemo(() => {
    if (!upcomingMilestone) {
      return 0;
    }
    return Math.max(upcomingMilestone.threshold - streakCount, 0);
  }, [streakCount, upcomingMilestone]);

  const supportingText = useMemo(() => {
    if (streakCount <= 0) {
      return "Solve today’s puzzles to begin your streak.";
    }
    if (!lastCompletedDate) {
      return `Keep the streak alive!`;
    }
    return `Last completion: ${format(lastCompletedDate, "MMM d, yyyy")}`;
  }, [lastCompletedDate, streakCount]);

  const milestoneMessage = useMemo(() => {
    if (!upcomingMilestone) {
      return "You’ve unlocked every streak milestone. Legendary!";
    }
    if (daysRemaining === 0) {
      return `Milestone unlocked: ${upcomingMilestone.rewardName}`;
    }
    if (daysRemaining === 1) {
      return `One more day until ${upcomingMilestone.rewardName}!`;
    }
    return `${daysRemaining} days until ${upcomingMilestone.rewardName}`;
  }, [daysRemaining, upcomingMilestone]);

  return (
    <section
      className={classNames(
        "relative overflow-hidden rounded-3xl border border-white/10 bg-surface-raised/70 p-5 shadow-ambient backdrop-blur-2xl sm:p-7",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />
      <div className="relative space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200/80">
              Current streak
            </p>
            <p className="text-3xl font-display font-semibold text-white sm:text-4xl">
              {streakCount}
              <span className="ml-2 text-base font-sans font-normal text-neutral-300">
                day{streakCount === 1 ? "" : "s"}
              </span>
            </p>
            <p className="text-sm text-neutral-300/90">{supportingText}</p>
          </div>
          <div className="max-w-xs rounded-2xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-3 text-sm font-medium text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
            {milestoneMessage}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex flex-col justify-between py-1 text-[11px] font-semibold uppercase tracking-[0.35em] text-neutral-500">
              {WEEKDAY_LABELS.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
            <div className="streak-heatmap" role="grid" aria-label="Calendar streak heatmap">
              {weekColumns.map((week) => (
                <div key={week.key} role="row" className="streak-heatmap__week">
                  {week.days.map((day) => (
                    <div
                      key={day.iso}
                      role="gridcell"
                      aria-label={`${day.label} · ${day.isSolved ? "Completed" : "Incomplete"}`}
                      className={classNames(
                        "streak-heatmap__day",
                        `streak-heatmap__day--level-${day.level}`,
                        day.isToday ? "streak-heatmap__day--today" : null,
                      )}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-500">
            <span>Less</span>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4].map((level) => (
                <span
                  key={level}
                  className={classNames(
                    "streak-heatmap__day streak-heatmap__legend",
                    `streak-heatmap__day--level-${level}`,
                  )}
                />
              ))}
            </div>
            <span>More</span>
          </div>
        </div>
      </div>
    </section>
  );
}
