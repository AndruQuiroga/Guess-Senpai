import Link from "next/link";

const API_BASE =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://localhost:8000";

interface ArchiveIndexResponse {
  dates: string[];
}

interface ArchivePageProps {
  searchParams?: {
    selected?: string | string[];
  };
}

function normalizeSelected(value?: string | string[]): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
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

async function fetchArchiveIndex(): Promise<ArchiveIndexResponse | null> {
  try {
    const response = await fetch(`${API_BASE}/puzzles/archive`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as ArchiveIndexResponse;
  } catch (error) {
    console.error("Failed to fetch archive index", error);
    return null;
  }
}

export default async function ArchiveIndexPage({ searchParams }: ArchivePageProps) {
  const selectedParam = normalizeSelected(searchParams?.selected);
  const archiveIndex = await fetchArchiveIndex();

  if (!archiveIndex) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-3xl border border-red-500/40 bg-red-500/10 px-6 py-5 text-red-100">
          <h1 className="text-2xl font-semibold">Archive Unavailable</h1>
          <p className="mt-2 text-sm text-red-100/80">
            We couldn&apos;t load the archive dates right now. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  const selectedDate = selectedParam && archiveIndex.dates.includes(selectedParam) ? selectedParam : undefined;

  if (archiveIndex.dates.length === 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-3">
          <p className="text-sm uppercase tracking-wider text-brand-200/80">Archive</p>
          <h1 className="text-4xl font-semibold text-white">Archive coming soon</h1>
          <p className="text-sm text-neutral-300">New puzzles are on their way. Check back soon for replayable challenges.</p>
        </header>
      </div>
    );
  }

  const groupedByMonth = archiveIndex.dates.reduce(
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

  const monthEntries = Array.from(groupedByMonth.entries()).sort((a, b) => a[1].order - b[1].order);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-3">
        <p className="text-sm uppercase tracking-wider text-brand-200/80">Archive</p>
        <h1 className="text-4xl font-semibold text-white">Pick a day to replay the challenge</h1>
        <p className="text-sm text-neutral-300">
          Relive previous GuessSenpai challenges. Select a date to jump directly into that day&apos;s puzzle set.
        </p>
      </header>

      <div className="space-y-6">
        {monthEntries.map(([monthLabel, { dates }]) => (
          <section key={monthLabel} className="space-y-3">
            <h2 className="text-lg font-semibold text-white/90">{monthLabel}</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {dates.map((isoDate) => {
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
    </div>
  );
}
