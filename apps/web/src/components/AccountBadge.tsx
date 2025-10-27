"use client";

import Link from "next/link";

import { useAccount } from "../hooks/useAccount";

export default function AccountBadge() {
  const { account, loading, streakCount, logout } = useAccount();

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
      <Link
        href="/account"
        className="group flex items-center gap-3"
        title={
          typeof streakCount === "number" ? `Current streak: ${streakCount} day${streakCount === 1 ? "" : "s"}` : undefined
        }
      >
        {account.user?.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={account.user.avatar}
            alt={account.user?.username ?? "AniList user"}
            className="h-8 w-8 rounded-full border border-white/20 object-cover shadow-inner shadow-black/40 transition group-hover:border-brand-300"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-brand-500/30 font-semibold uppercase transition group-hover:border-brand-300 group-hover:text-white">
            {(account.user?.username ?? "GS").slice(0, 2)}
          </div>
        )}
        <span className="max-w-[120px] truncate font-semibold text-white/90 group-hover:text-white">
          {account.user?.username ?? "AniList user"}
        </span>
      </Link>
      <button
        type="button"
        onClick={() => {
          void logout();
        }}
        className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-neutral-200 transition hover:border-red-400/60 hover:text-red-200"
      >
        Logout
      </button>
    </div>
  );
}
