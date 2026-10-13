import Link from "next/link";
import { cookies } from "next/headers";

import Daily from "../../../components/Daily";
import { DailyPuzzleResponse } from "../../../types/puzzles";

const API_BASE =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://localhost:8000";

interface Props {
  params: Promise<{ date: string }>;
}

function formatDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }
  return parsed.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

async function fetchArchivedPuzzle(
  date: string,
): Promise<DailyPuzzleResponse | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("guesssenpai_session");
    const headers = sessionCookie
      ? { cookie: `guesssenpai_session=${sessionCookie.value}` }
      : undefined;
    const response = await fetch(`${API_BASE}/puzzles/today?d=${date}`, {
      cache: "no-store",
      headers,
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as DailyPuzzleResponse;
  } catch (error) {
    console.error("Failed to fetch archive", error);
    return null;
  }
}

export default async function ArchivePage({ params }: Props) {
  const { date } = await params;
  const data = await fetchArchivedPuzzle(date);
  const formattedDate = formatDate(date);
  const archiveHref = `/archive?selected=${encodeURIComponent(date)}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex items-center gap-2 text-sm text-muted">
          <Link
            href={archiveHref}
            className="font-medium text-muted transition hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Archive
          </Link>
          <span className="text-muted">/</span>
          <span className="font-semibold text-paper">{formattedDate}</span>
        </nav>
        <Link
          href={archiveHref}
          className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-panel-raised px-4 py-2 text-sm font-medium text-muted transition hover:border-signal hover:bg-signal-soft hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          ← Back to archive index
        </Link>
      </div>
      <Daily data={data} />
    </div>
  );
}
