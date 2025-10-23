import Daily from "../../../components/Daily";
import { DailyPuzzleResponse } from "../../../types/puzzles";
import { cookies } from "next/headers";

const API_BASE =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://localhost:8000";

interface Props {
  params: { date: string };
}

async function fetchArchivedPuzzle(date: string): Promise<DailyPuzzleResponse | null> {
  try {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get("guesssenpai_session");
    const headers = sessionCookie ? { cookie: `guesssenpai_session=${sessionCookie.value}` } : undefined;
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
  const data = await fetchArchivedPuzzle(params.date);
  return <Daily data={data} />;
}
