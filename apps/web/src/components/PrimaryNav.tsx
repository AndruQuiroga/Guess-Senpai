"use client";

import AccountBadge from "./AccountBadge";
import NavLink from "./NavLink";

interface PrimaryNavProps {
  archiveDate: string;
}

export default function PrimaryNav({ archiveDate }: PrimaryNavProps) {
  return (
    <nav className="flex items-center gap-2 text-sm">
      <NavLink href="/" exact>
        Home
      </NavLink>
      <NavLink href="/games/daily">Daily Challenge</NavLink>
      <NavLink
        href="/games"
        isActive={(pathname) =>
          pathname === "/games" ||
          (pathname.startsWith("/games/") && !pathname.startsWith("/games/daily"))
        }
      >
        Games
      </NavLink>
      <NavLink href="/how-to-play">How to Play</NavLink>
      <NavLink
        href={`/archive?selected=${encodeURIComponent(archiveDate)}`}
        isActive={(pathname) => pathname === "/archive" || pathname.startsWith("/archive/")}
      >
        Archive
      </NavLink>
      <AccountBadge />
    </nav>
  );
}

