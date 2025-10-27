import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import type { DailyPuzzleResponse } from "../../../../types/puzzles";
import { findPuzzleSlug } from "../slugs";
import { LiveGameClient } from "./LiveGameClient";

const API_BASE =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://localhost:8000";

interface AccountUser {
  id: number;
  username?: string | null;
  avatar?: string | null;
}

interface AccountState {
  authenticated: boolean;
  user?: AccountUser | null;
}

async function fetchWithSession(path: string) {
  const cookieStore = cookies();
  const session = cookieStore.get("guesssenpai_session");
  const headers = new Headers();
  if (session) {
    headers.set("cookie", `${session.name}=${session.value}`);
  }
  const response = await fetch(`${API_BASE}${path}`, {
    headers,
    cache: "no-store",
  });
  return response;
}

async function fetchDailyPuzzles(): Promise<DailyPuzzleResponse | null> {
  try {
    const response = await fetchWithSession("/puzzles/today");
    if (!response.ok) {
      console.error("Failed to fetch live puzzles", response.status);
      return null;
    }
    return (await response.json()) as DailyPuzzleResponse;
  } catch (error) {
    console.error("Error fetching live puzzles", error);
    return null;
  }
}

async function fetchAccount(): Promise<AccountState | null> {
  try {
    const response = await fetchWithSession("/auth/anilist/me");
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as AccountState;
  } catch (error) {
    console.error("Failed to fetch account for live game", error);
    return null;
  }
}

export default async function LiveGamePage({
  params,
}: {
  params: { slug: string };
}) {
  const slugDefinition = findPuzzleSlug(params.slug);
  if (!slugDefinition) {
    notFound();
  }

  const [puzzleData, account] = await Promise.all([
    fetchDailyPuzzles(),
    fetchAccount(),
  ]);

  const lobbyId = slugDefinition.slug;
  const matchId = `${slugDefinition.slug}-match`;

  const playerProfile = account?.authenticated && account.user
    ? {
        id: String(account.user.id),
        name: account.user.username ?? null,
        avatar: account.user.avatar ?? null,
      }
    : {
        id: randomUUID(),
        name: null,
        avatar: null,
      };

  return (
    <LiveGameClient
      slugDefinition={slugDefinition}
      puzzleData={puzzleData}
      lobbyId={lobbyId}
      matchId={matchId}
      playerProfile={playerProfile}
      autoReconnect
    />
  );
}
