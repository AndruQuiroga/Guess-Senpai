import Link from "next/link";

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

export default async function ArchiveIndexPage({
  searchParams,
}: ArchivePageProps) {
  const selectedParam = normalizeSelected(searchParams?.selected);
  const archiveIndex = await fetchArchiveIndex();

  if (!archiveIndex) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-lg border border-danger bg-danger-soft px-6 py-5 text-paper">
          <h1 className="text-2xl font-semibold">Archive Unavailable</h1>
          <p className="mt-2 text-sm text-danger-ink">
            We couldn&apos;t load the archive dates right now. You can retry
            without leaving the archive.
          </p>
          <Link href="/archive" className="button button-primary mt-4">
            Retry archive
          </Link>
        </div>
      </div>
    );
  }

  const selectedDate =
    selectedParam && archiveIndex.dates.includes(selectedParam)
      ? selectedParam
      : undefined;

  if (archiveIndex.dates.length === 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-3">
          <p className="text-sm uppercase tracking-wider text-muted">Archive</p>
          <h1 className="text-4xl font-semibold text-paper">
            No published puzzles yet
          </h1>
          <p className="text-sm text-muted">
            Published daily puzzles will appear here after they become
            available.
          </p>
        </header>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <ArchiveIndexContent
        dates={archiveIndex.dates}
        selectedDate={selectedDate}
      />
    </div>
  );
}
