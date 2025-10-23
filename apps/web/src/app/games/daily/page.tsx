import Daily from "../../../components/Daily";
import { DailyPuzzleResponse } from "../../../types/puzzles";
import { cookies } from "next/headers";

const API_BASE =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://localhost:8000";

async function fetchDailyPuzzles(): Promise<DailyPuzzleResponse | null> {
  try {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get("guesssenpai_session");
    const headers = sessionCookie ? { cookie: `guesssenpai_session=${sessionCookie.value}` } : undefined;
    const response = await fetch(`${API_BASE}/puzzles/today`, {
      cache: "no-store",
      headers,
    });
    if (!response.ok) {
      console.error("Failed to fetch puzzles", await response.text());
      return null;
    }
    return (await response.json()) as DailyPuzzleResponse;
  } catch (error) {
    console.error("Error fetching puzzles", error);
    return null;
  }
}

export default async function DailyPage() {
  const data = await fetchDailyPuzzles();
  return <Daily data={data} />;
}
