"use client";

import Link from "next/link";

import { useAccount } from "../hooks/useAccount";

export default function AccountBadge() {
  const { account, loading, error, refresh, streakCount, logout } =
    useAccount();

  if (loading) {
    return (
      <div className="flex min-h-11 items-center gap-2 rounded-md border border-[#484b4d] bg-[#242628] px-3 py-1.5 text-sm text-[#c1c2bd]">
        Loading…
      </div>
    );
  }

  if (error)
    return (
      <button className="button" onClick={() => void refresh()}>
        {error} Retry
      </button>
    );

  if (!account.authenticated) {
    return (
      <Link
        href="/login"
        className="inline-flex min-h-11 items-center rounded-md border border-[#686b6d] bg-[#2c2f31] px-4 py-2 text-sm font-semibold text-[#f4f0e7] transition hover:border-[#ff987f]"
      >
        AniList Login
      </Link>
    );
  }

  return (
    <div className="flex min-h-11 items-center gap-3 rounded-md border border-[#484b4d] bg-[#242628] px-3 py-1.5 text-sm text-[#f4f0e7]">
      <Link
        href="/account"
        className="group flex items-center gap-3"
        title={
          typeof streakCount === "number"
            ? `Current streak: ${streakCount} day${streakCount === 1 ? "" : "s"}`
            : undefined
        }
      >
        {account.user?.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={account.user.avatar}
            alt={account.user?.username ?? "AniList user"}
            className="h-8 w-8 rounded-full border border-[#686b6d] object-cover shadow-black/40 transition group-hover:border-brand-300"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#686b6d] bg-[#3a2a25] font-semibold uppercase transition group-hover:border-brand-300 group-hover:text-white">
            {(account.user?.username ?? "GS").slice(0, 2)}
          </div>
        )}
        <span className="max-w-[120px] truncate font-semibold text-[#f4f0e7] group-hover:text-white">
          {account.user?.username ?? "AniList user"}
        </span>
      </Link>
      <button
        type="button"
        onClick={() => {
          void logout();
        }}
        className="button min-h-11 border border-[#686b6d] bg-[#2c2f31] text-sm text-[#f4f0e7] transition hover:border-[#ff987f]"
      >
        Logout
      </button>
    </div>
  );
}
