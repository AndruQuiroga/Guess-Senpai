"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

interface AccountState {
  authenticated: boolean;
  user?: {
    id: number;
    username?: string | null;
    avatar?: string | null;
  };
}

export default function AccountBadge() {
  const [account, setAccount] = useState<AccountState>({ authenticated: false });
  const [loading, setLoading] = useState(true);

  const fetchAccount = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/auth/anilist/me`, {
        credentials: "include",
      });
      const data = (await response.json()) as AccountState;
      setAccount(data);
    } catch (error) {
      console.warn("Unable to fetch account info", error);
      setAccount({ authenticated: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccount();
  }, [fetchAccount]);

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/auth/anilist/logout`, {
        method: "POST",
        credentials: "include",
      });
      setAccount({ authenticated: false });
    } catch (error) {
      console.warn("Logout failed", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs text-neutral-300">
        Loading…
      </div>
    );
  }

  if (!account.authenticated) {
    return (
      <Link
        href="/login"
        className="rounded-full border border-brand-400/40 bg-brand-500/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-brand-100 transition hover:border-brand-300 hover:text-white"
      >
        AniList Login
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs text-white backdrop-blur-lg">
      {account.user?.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={account.user.avatar}
          alt={account.user?.username ?? "AniList user"}
          className="h-8 w-8 rounded-full border border-white/20 object-cover shadow-inner shadow-black/40"
        />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-brand-500/30 font-semibold uppercase">
          {(account.user?.username ?? "GS").slice(0, 2)}
        </div>
      )}
      <span className="max-w-[120px] truncate font-semibold text-white/90">
        {account.user?.username ?? "AniList user"}
      </span>
      <button
        type="button"
        onClick={handleLogout}
        className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-neutral-200 transition hover:border-red-400/60 hover:text-red-200"
      >
        Logout
      </button>
    </div>
  );
}
