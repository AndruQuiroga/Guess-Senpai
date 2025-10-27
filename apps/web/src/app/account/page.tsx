import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { GlassSection } from "../../components/GlassSection";
import { RecentMediaList } from "../../components/account/RecentMediaList";
import { SharePanel } from "../../components/account/SharePanel";
import { StreakHistoryCard } from "../../components/account/StreakHistoryCard";
import { DifficultyPreferenceCard } from "../../components/account/DifficultyPreferenceCard";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

interface AccountUser {
  id: number;
  username?: string | null;
  avatar?: string | null;
}

interface AccountState {
  authenticated: boolean;
  user?: AccountUser;
}

interface PuzzleStatsResponse {
  streak: {
    count: number;
    last_completed?: string | null;
  };
  completion_rate: number;
  total_games: number;
  completed_games: number;
  active_days: number;
  history: Array<{
    date: string;
    completed: number;
    total: number;
  }>;
  recent_media_ids: number[];
  recent_media: Array<{
    id: number;
    title: {
      romaji?: string | null;
      english?: string | null;
      native?: string | null;
      userPreferred?: string | null;
    };
    coverImage?: string | null;
  }>;
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

export default async function AccountPage() {
  const statsResponse = await fetchWithSession("/puzzles/stats");
  if (statsResponse.status === 401) {
    redirect("/login");
  }
  if (!statsResponse.ok) {
    throw new Error("Unable to load account stats");
  }
  const stats = (await statsResponse.json()) as PuzzleStatsResponse;

  const accountResponse = await fetchWithSession("/auth/anilist/me");
  const account = accountResponse.ok
    ? ((await accountResponse.json()) as AccountState)
    : { authenticated: false };

  if (!account.authenticated) {
    redirect("/login");
  }

  const completionRatePercent = Math.round(stats.completion_rate * 100);

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <h1 className="text-3xl font-display font-semibold tracking-tight text-white sm:text-4xl">
            Welcome back{account.user?.username ? `, ${account.user.username}` : ""}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-neutral-300">
            Track your GuessSenpai journey: monitor streaks, revisit recent puzzles, and share your achievements with
            friends.
          </p>
        </div>
        <GlassSection className="flex-1 sm:max-w-sm" innerClassName="flex items-center gap-4">
          {account.user?.avatar ? (
            <img
              src={account.user.avatar}
              alt={account.user.username ?? "AniList user"}
              className="h-16 w-16 rounded-full border border-white/20 object-cover shadow-inner shadow-black/40"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-brand-500/20 text-lg font-semibold uppercase text-white">
              {(account.user?.username ?? "GS").slice(0, 2)}
            </div>
          )}
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white/90">{account.user?.username ?? "AniList user"}</p>
            <p className="text-xs text-neutral-400">{stats.active_days} active day{stats.active_days === 1 ? "" : "s"}</p>
            <p className="text-xs text-neutral-400">{completionRatePercent}% completion rate</p>
          </div>
        </GlassSection>
      </header>

      <DifficultyPreferenceCard />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <StreakHistoryCard
            streakCount={stats.streak.count}
            lastCompleted={stats.streak.last_completed}
            history={stats.history}
          />
        </div>
        <div className="lg:col-span-2">
          <RecentMediaList items={stats.recent_media} />
        </div>
      </div>

      <SharePanel
        username={account.user?.username}
        streakCount={stats.streak.count}
        completionRate={stats.completion_rate}
      />
    </div>
  );
}
