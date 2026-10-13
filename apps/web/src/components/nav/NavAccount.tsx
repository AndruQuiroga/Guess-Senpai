"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAccount } from "../../hooks/useAccount";
import { NavIcon } from "./NavIcon";

const rowBase =
  "inline-flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition";

/** Account / sign-in controls. `compact` is the icon-only mobile top bar. */
export function NavAccount({ compact = false }: { compact?: boolean }) {
  const { account, loading, resolved, error, refresh, logout } = useAccount();
  const pathname = usePathname() ?? "";

  if (loading && !resolved) {
    return compact ? (
      <span className="inline-block h-11 w-11" aria-hidden="true" />
    ) : (
      <p role="status" className={`${rowBase} text-muted`}>
        Loading account…
      </p>
    );
  }

  if (error && !account.authenticated) {
    return (
      <button
        type="button"
        onClick={() => void refresh()}
        className={`${rowBase} border border-line-strong text-paper hover:bg-hover`}
      >
        {compact ? "Retry" : "Account unavailable. Retry"}
      </button>
    );
  }

  if (!account.authenticated) {
    const active = pathname === "/login";
    return (
      <Link
        href="/login"
        aria-current={active ? "page" : undefined}
        aria-label={compact ? "Sign in" : undefined}
        className={`${rowBase} ${
          compact ? "w-11 justify-center px-0" : "w-full"
        } ${active ? "bg-panel-raised text-paper" : "text-paper hover:bg-hover"}`}
      >
        <NavIcon name="account" />
        {compact ? null : <span>Sign in</span>}
      </Link>
    );
  }

  const name = account.user?.username ?? "AniList user";
  const avatar = account.user?.avatar ?? null;
  const active = pathname === "/account" || pathname.startsWith("/account/");
  return (
    <div className={compact ? "flex items-center gap-1" : "space-y-1"}>
      <Link
        href="/account"
        aria-current={active ? "page" : undefined}
        aria-label={compact ? `Account: ${name}` : undefined}
        className={`${rowBase} ${compact ? "w-11 justify-center px-0" : "w-full"} ${
          active ? "bg-panel-raised text-paper" : "text-paper hover:bg-hover"
        }`}
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar}
            alt=""
            width={24}
            height={24}
            className="h-6 w-6 shrink-0 rounded-full border border-line-strong object-cover"
          />
        ) : (
          <NavIcon name="account" />
        )}
        {compact ? null : <span className="min-w-0 truncate">{name}</span>}
      </Link>
      <button
        type="button"
        onClick={() => void logout()}
        className={`${rowBase} text-muted hover:bg-hover hover:text-paper ${
          compact ? "" : "w-full"
        }`}
      >
        Log out
      </button>
    </div>
  );
}
