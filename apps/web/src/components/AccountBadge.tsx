"use client";

import Link from "next/link";

import { useAccount } from "../hooks/useAccount";

export default function AccountBadge() {
  const { account, loading, error, refresh, streakCount, logout } =
    useAccount();

  if (loading) {
    return (
      <div className="flex min-h-11 items-center gap-2 rounded-md border border-line bg-panel px-3 py-1.5 text-sm text-muted">
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
        className="inline-flex min-h-11 items-center rounded-md border border-line-strong bg-panel-raised px-4 py-2 text-sm font-semibold text-paper transition hover:border-signal-text"
      >
        AniList Login
      </Link>
    );
  }

  return (
    <div className="flex min-h-11 items-center gap-3 rounded-md border border-line bg-panel px-3 py-1.5 text-sm text-paper">
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
            className="h-8 w-8 rounded-full border border-line-strong object-cover transition group-hover:border-signal-text"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-line-strong bg-signal-soft font-semibold uppercase transition group-hover:border-signal-text group-hover:text-paper">
            {(account.user?.username ?? "GS").slice(0, 2)}
          </div>
        )}
        <span className="max-w-[120px] truncate font-semibold text-paper group-hover:text-paper">
          {account.user?.username ?? "AniList user"}
        </span>
      </Link>
      <button
        type="button"
        onClick={() => {
          void logout();
        }}
        className="button min-h-11 border border-line-strong bg-panel-raised text-sm text-paper transition hover:border-signal-text"
      >
        Logout
      </button>
    </div>
  );
}
