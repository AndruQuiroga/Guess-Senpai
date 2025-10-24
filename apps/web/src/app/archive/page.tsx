import ArchiveIndexContent from "./ArchiveIndexContent";

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

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <ArchiveIndexContent dates={archiveIndex.dates} selectedDate={selectedDate} />
    </div>
  );
}
