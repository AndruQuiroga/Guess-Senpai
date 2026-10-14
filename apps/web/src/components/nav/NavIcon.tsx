import type { ReactNode } from "react";

export type NavIconName =
  | "today"
  | "anidle"
  | "poster-zoomed"
  | "poster-modified"
  | "character-silhouette"
  | "redacted-synopsis"
  | "guess-the-opening"
  | "archive"
  | "how-to-play"
  | "unlimited"
  | "account"
  | "game";

const PATHS: Record<NavIconName, ReactNode> = {
  "poster-modified": (
    <>
      <rect x="4" y="4" width="16" height="16" rx="1" />
      <path d="M4 12h16M12 4v16M4 4l16 16" />
    </>
  ),
  today: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  anidle: (
    <>
      <rect x="3.5" y="4" width="17" height="16" rx="2" />
      <path d="M3.5 9.5h17M9.2 9.5V20M14.8 9.5V20" />
    </>
  ),
  "poster-zoomed": (
    <>
      <path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" />
      <path d="m8.5 15 2.5-3 2 2 1.5-1.5 2 2.5" />
    </>
  ),
  "character-silhouette": (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-4 3-6.5 7-6.5s7 2.5 7 6.5" />
    </>
  ),
  "redacted-synopsis": (
    <>
      <path d="M4 7h16M4 17h10" />
      <rect x="4" y="11" width="11" height="2.6" rx="0.5" fill="currentColor" />
    </>
  ),
  "guess-the-opening": (
    <>
      <path d="M9 18V6l10-2v12" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="16.5" cy="16" r="2.5" />
    </>
  ),
  archive: (
    <>
      <rect x="3.5" y="4.5" width="17" height="4" rx="1" />
      <path d="M5 8.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5M10 12.5h4" />
    </>
  ),
  "how-to-play": (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.6a2.4 2.4 0 1 1 3.4 2.2c-.7.4-1 .9-1 1.7M12 16.6v.1" />
    </>
  ),
  unlimited: (
    <path d="M12 12c-1.6-2.4-3-3.5-4.8-3.5a3.5 3.5 0 0 0 0 7c1.8 0 3.2-1.1 4.8-3.5Zm0 0c1.6 2.4 3 3.5 4.8 3.5a3.5 3.5 0 0 0 0-7c-1.8 0-3.2 1.1-4.8 3.5Z" />
  ),
  account: (
    <>
      <circle cx="12" cy="9" r="3.5" />
      <path d="M5 20c0-3.6 3-5.5 7-5.5s7 1.9 7 5.5" />
    </>
  ),
  game: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M10 9.5v5l4-2.5z" />
    </>
  ),
};

export function NavIcon({
  name,
  className = "h-5 w-5",
}: {
  name: string;
  className?: string;
}) {
  const icon = PATHS[name as NavIconName] ?? PATHS.game;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`}
    >
      {icon}
    </svg>
  );
}
