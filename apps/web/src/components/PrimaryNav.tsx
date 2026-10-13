"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import NavLink, { matchesPath } from "./NavLink";
import { NavAccount } from "./nav/NavAccount";
import { NavIcon } from "./nav/NavIcon";
import { StatusMark } from "./nav/StatusMark";
import { useDailyScore } from "./nav/useDailyScore";
import { useNavGames, type NavGame } from "./nav/useNavGames";
import { formatDailyScore, type DailyScore } from "../utils/dailyScore";
import { GAME_STATUS_TEXT, type GameStatus } from "../utils/gameAction";

interface PrimaryNavProps {
  archiveDate: string;
}

const STATUS_GLYPH: Record<GameStatus, string> = {
  new: "○",
  "in-progress": "◐",
  solved: "✓",
  "out-of-guesses": "✕",
};

function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="GuessSenpai, Today"
      className={`inline-flex min-h-11 items-center rounded-md font-display text-xl font-bold tracking-tight text-paper ${className}`.trim()}
    >
      Guess<span className="text-signal">Senpai</span>
    </Link>
  );
}

function archiveHref(archiveDate: string) {
  return `/archive?selected=${encodeURIComponent(archiveDate)}`;
}

const isArchive = (pathname: string) =>
  matchesPath(pathname, "/archive", false);

/**
 * Persistent navigation. From md up it is a left sidebar listing every playable
 * mode with today's status. Below md it is a compact top bar plus a horizontally
 * scrollable row of mode chips: there is no hamburger, so every mode stays one
 * tap away and nothing hidden stays in the Tab order.
 */
export default function PrimaryNav({ archiveDate }: PrimaryNavProps) {
  const games = useNavGames();
  const score = useDailyScore();
  return (
    <>
      <DesktopSidebar games={games} archiveDate={archiveDate} score={score} />
      <MobileNav games={games} archiveDate={archiveDate} score={score} />
    </>
  );
}

function DesktopSidebar({
  games,
  archiveDate,
  score,
}: {
  games: NavGame[];
  archiveDate: string;
  score: DailyScore | null;
}) {
  return (
    <aside className="hidden border-r border-line bg-ink md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col md:px-3 md:py-4">
      <Wordmark className="mb-4 px-3" />
      <nav
        aria-label="Primary"
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto"
      >
        <NavLink href="/" exact className="w-full">
          <NavIcon name="today" />
          Today
        </NavLink>

        <p
          id="sidebar-games-heading"
          className="mt-3 px-3 pb-1 text-sm font-semibold text-muted"
        >
          Daily games
        </p>
        <ul aria-labelledby="sidebar-games-heading" className="space-y-1">
          {games.map((game) => (
            <li key={game.slug}>
              <NavLink href={game.href} className="w-full !items-center py-2">
                <NavIcon name={game.slug} />
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate">{game.title}</span>
                  {game.status ? (
                    <StatusMark status={game.status} className="mt-0.5" />
                  ) : null}
                </span>
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="mt-3 space-y-1 border-t border-line-subtle pt-3">
          <NavLink
            href={archiveHref(archiveDate)}
            isActive={isArchive}
            className="w-full"
          >
            <NavIcon name="archive" />
            Archive
          </NavLink>
          <NavLink href="/how-to-play" className="w-full">
            <NavIcon name="how-to-play" />
            How to play
          </NavLink>
        </div>
      </nav>
      <div className="mt-3 space-y-2 border-t border-line-subtle pt-3">
        {score ? (
          <Link
            href="/how-to-play#daily-score"
            className="block rounded-md px-3 py-1 text-sm no-underline hover:bg-hover"
            aria-label={`Today's score ${formatDailyScore(score)}. How scoring works`}
          >
            <span className="block text-muted">Today&apos;s score</span>
            <span className="block font-display text-lg font-bold text-paper">
              {formatDailyScore(score)}
            </span>
          </Link>
        ) : null}
        <NavAccount />
      </div>
    </aside>
  );
}

const chipBase =
  "inline-flex min-h-11 shrink-0 snap-start items-center gap-2 whitespace-nowrap rounded-md border px-3 text-sm font-semibold transition";

function MobileNav({
  games,
  archiveDate,
  score,
}: {
  games: NavGame[];
  archiveDate: string;
  score: DailyScore | null;
}) {
  const pathname = usePathname() ?? "";
  const rowRef = useRef<HTMLUListElement>(null);

  // Keep the current page's chip in view when the row overflows.
  useEffect(() => {
    const current = rowRef.current?.querySelector<HTMLElement>(
      '[aria-current="page"]',
    );
    if (current && typeof current.scrollIntoView === "function") {
      current.scrollIntoView({ block: "nearest", inline: "center" });
    }
  }, [pathname, games.length]);

  const chipClass = (active: boolean) =>
    `${chipBase} ${
      active
        ? "border-signal bg-panel-raised text-paper"
        : "border-line bg-panel text-muted hover:bg-hover hover:text-paper"
    }`;

  const chip = (
    href: string,
    label: string,
    active: boolean,
    status?: GameStatus | null,
  ) => (
    <li key={href} className="shrink-0">
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={chipClass(active)}
      >
        {label}
        {status ? (
          <>
            <span aria-hidden="true">{STATUS_GLYPH[status]}</span>
            <span className="sr-only">, {GAME_STATUS_TEXT[status]}</span>
          </>
        ) : null}
      </Link>
    </li>
  );

  return (
    <div className="sticky top-0 z-30 border-b border-line bg-ink md:hidden">
      <div className="flex items-center justify-between px-4">
        <Wordmark />
        <div className="flex items-center gap-2">
          {score ? (
            <Link
              href="/how-to-play#daily-score"
              aria-label={`Today's score ${formatDailyScore(score)}. How scoring works`}
              className="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-semibold text-muted no-underline hover:text-paper"
            >
              {formatDailyScore(score)}
            </Link>
          ) : null}
          <NavAccount compact />
        </div>
      </div>
      <nav aria-label="Primary (compact)" className="px-4 pb-3">
        <ul
          ref={rowRef}
          className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {chip("/", "Today", pathname === "/")}
          {games.map((game) =>
            chip(
              game.href,
              game.title,
              matchesPath(pathname, game.href, false),
              game.status,
            ),
          )}
          {chip(archiveHref(archiveDate), "Archive", isArchive(pathname))}
          {chip(
            "/how-to-play",
            "How to play",
            matchesPath(pathname, "/how-to-play", false),
          )}
        </ul>
      </nav>
    </div>
  );
}
