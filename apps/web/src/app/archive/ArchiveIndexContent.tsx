"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

interface ArchiveIndexContentProps {
  dates: string[];
  selectedDate?: string;
}

function formatDateLabel(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }
  return parsed.toLocaleDateString(undefined, {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatMonthLabel(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate.slice(0, 7);
  }
  return parsed.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function ArchiveIndexContent({
  dates,
  selectedDate,
}: ArchiveIndexContentProps) {
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
    return filteredDates.reduce((acc, isoDate, index) => {
      const monthLabel = formatMonthLabel(isoDate);
      if (!acc.has(monthLabel)) {
        acc.set(monthLabel, { dates: [], order: index });
      }
      acc.get(monthLabel)!.dates.push(isoDate);
      return acc;
    }, new Map<string, { dates: string[]; order: number }>());
  }, [filteredDates]);

  const monthEntries = useMemo(() => {
    return Array.from(groupedByMonth.entries()).sort(
      (a, b) => a[1].order - b[1].order,
    );
  }, [groupedByMonth]);

  return (
    <>
      <header className="space-y-3">
        <p className="text-sm uppercase tracking-wider text-muted">Archive</p>
        <h1 className="text-3xl sm:text-4xl font-display font-semibold text-paper">
          Pick a published puzzle
        </h1>
        <p className="text-sm text-muted">
          Choose a published day to replay its puzzle set. Dates follow UTC.
        </p>
        <div className="pt-2">
          <label
            className="flex flex-col gap-1 text-sm"
            htmlFor="archive-search"
          >
            <span className="text-muted">Search by day or month</span>
            <input
              id="archive-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder='Try "March" or 2024-03-14'
              className="w-full rounded-lg border border-line-strong bg-panel-raised px-4 py-2 text-base text-paper placeholder:text-muted focus:border-signal focus:outline-none focus:ring-2 focus:ring-focus"
            />
          </label>
        </div>
      </header>

      {filteredDates.length === 0 ? (
        <div className="rounded-lg border border-line-strong bg-panel-raised px-6 py-10 text-center text-muted">
          <p className="text-base font-medium text-paper">
            {query ? "No matches found" : "No published puzzles yet"}
          </p>
          <p className="mt-2 text-sm text-muted">
            Try searching for a different date or month to find archived
            challenges.
          </p>
        </div>
      ) : (
        <div className="space-y-6" aria-live="polite">
          {monthEntries.map(([monthLabel, { dates: monthDates }]) => (
            <section key={monthLabel} className="space-y-3">
              <h2 className="text-lg font-semibold text-paper">{monthLabel}</h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {monthDates.map((isoDate) => {
                  const isSelected = selectedDate === isoDate;
                  const formattedLabel = formatDateLabel(isoDate);
                  return (
                    <li key={isoDate}>
                      <Link
                        href={`/archive/${isoDate}`}
                        className={`flex h-full flex-col justify-center rounded-lg border px-4 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 ${
                          isSelected
                            ? "border-signal bg-signal-soft text-paper "
                            : "border-line-strong bg-panel-raised text-muted hover:border-signal hover:bg-signal-soft hover:text-paper"
                        }`}
                        aria-current={isSelected ? "date" : undefined}
                      >
                        <span className="text-sm font-medium">
                          {formattedLabel}
                        </span>
                        <span className="text-sm text-muted">View puzzles</span>
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
