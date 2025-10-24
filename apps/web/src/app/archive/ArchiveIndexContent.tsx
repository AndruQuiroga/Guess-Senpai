"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

interface ArchiveIndexContentProps {
  dates: string[];
  selectedDate?: string;
}

function formatDateLabel(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }
  return parsed.toLocaleDateString(undefined, {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatMonthLabel(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate.slice(0, 7);
  }
  return parsed.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export default function ArchiveIndexContent({ dates, selectedDate }: ArchiveIndexContentProps) {
  const [query, setQuery] = useState("");

  const normalizedQuery = query.trim().toLowerCase();

  const filteredDates = useMemo(() => {
    if (!normalizedQuery) {
      return dates;
    }

    return dates.filter((isoDate) => {
      const formattedLabel = formatDateLabel(isoDate).toLowerCase();
      const formattedMonth = formatMonthLabel(isoDate).toLowerCase();
      return (
        isoDate.toLowerCase().includes(normalizedQuery) ||
        formattedLabel.includes(normalizedQuery) ||
        formattedMonth.includes(normalizedQuery)
      );
    });
  }, [dates, normalizedQuery]);

  const groupedByMonth = useMemo(() => {
    return filteredDates.reduce(
      (acc, isoDate, index) => {
        const monthLabel = formatMonthLabel(isoDate);
        if (!acc.has(monthLabel)) {
          acc.set(monthLabel, { dates: [], order: index });
        }
        acc.get(monthLabel)!.dates.push(isoDate);
        return acc;
      },
      new Map<string, { dates: string[]; order: number }>(),
    );
  }, [filteredDates]);

  const monthEntries = useMemo(() => {
    return Array.from(groupedByMonth.entries()).sort((a, b) => a[1].order - b[1].order);
  }, [groupedByMonth]);

  return (
    <>
      <header className="space-y-3">
        <p className="text-sm uppercase tracking-wider text-brand-200/80">Archive</p>
        <h1 className="text-4xl font-semibold text-white">Pick a day to replay the challenge</h1>
        <p className="text-sm text-neutral-300">
          Relive previous GuessSenpai challenges. Select a date to jump directly into that day&apos;s puzzle set.
        </p>
        <div className="pt-2">
          <label className="flex flex-col gap-1 text-sm" htmlFor="archive-search">
            <span className="text-neutral-300">Search by day or month</span>
            <input
              id="archive-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try &quot;March&quot; or 2024-03-14"
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-base text-white placeholder:text-neutral-500 focus:border-brand-300/80 focus:outline-none focus:ring-2 focus:ring-brand-400/50"
            />
          </label>
        </div>
      </header>

      {filteredDates.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-10 text-center text-neutral-300">
          <p className="text-base font-medium text-white">No matches found</p>
          <p className="mt-2 text-sm text-neutral-400">
            Try searching for a different date or month to find archived challenges.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {monthEntries.map(([monthLabel, { dates: monthDates }]) => (
            <section key={monthLabel} className="space-y-3">
              <h2 className="text-lg font-semibold text-white/90">{monthLabel}</h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {monthDates.map((isoDate) => {
                  const isSelected = selectedDate === isoDate;
                  const formattedLabel = formatDateLabel(isoDate);
                  return (
                    <li key={isoDate}>
                      <Link
                        href={`/archive/${isoDate}`}
                        className={`flex h-full flex-col justify-center rounded-2xl border px-4 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 ${
                          isSelected
                            ? "border-brand-400/80 bg-brand-500/20 text-white shadow-[0_0_0_1px_rgba(59,130,246,0.4)]"
                            : "border-white/10 bg-white/5 text-neutral-200 hover:border-brand-300/60 hover:bg-brand-500/10 hover:text-white"
                        }`}
                        aria-current={isSelected ? "date" : undefined}
                      >
                        <span className="text-sm font-medium">{formattedLabel}</span>
                        <span className="text-xs text-neutral-400">View puzzles</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
