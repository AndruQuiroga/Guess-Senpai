import Link from "next/link";

import AccountBadge from "../components/AccountBadge";
import SessionRefresher from "../components/SessionRefresher";
import NavLink from "../components/NavLink";
import "../styles/globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <html lang="en" className="dark">
      <body className="relative min-h-screen text-neutral-100 antialiased selection:bg-brand-500/40 selection:text-white">
        <SessionRefresher />
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_-10%,rgba(59,130,246,0.25),transparent_60%),radial-gradient(circle_at_80%_0%,rgba(14,165,233,0.18),transparent_60%),radial-gradient(circle_at_50%_100%,rgba(236,72,153,0.12),transparent_70%)] opacity-70 blur-[140px]" />
        </div>
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-8 sm:px-6 lg:px-10">
          <header className="mb-10 flex items-center justify-between rounded-full border border-white/10 bg-white/5 px-6 py-4 text-sm text-neutral-300 shadow-glow backdrop-blur-xl">
            <Link
              href="/"
              className="text-xl font-display font-semibold tracking-tight text-white transition hover:text-brand-300"
            >
              Guess<span className="text-brand-300">Senpai</span>
            </Link>
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
                href={`/archive?selected=${encodeURIComponent(today)}`}
                isActive={(pathname) => pathname === "/archive" || pathname.startsWith("/archive/")}
              >
                Archive
              </NavLink>
              <AccountBadge />
            </nav>
          </header>
          <main className="flex-1 pb-16">{children}</main>
          <footer className="mt-auto flex items-center justify-between rounded-3xl border border-white/10 bg-white/5 px-6 py-4 text-xs text-neutral-400 backdrop-blur-xl">
            <span>Built with AniList &amp; AnimeThemes data.</span>
            <span className="text-neutral-500">Stay curious · Guess wisely.</span>
          </footer>
        </div>
      </body>
    </html>
  );
}
