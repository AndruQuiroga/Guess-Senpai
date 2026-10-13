import type { Metadata, Viewport } from "next";
import Link from "next/link";

import SessionRefresher from "../components/SessionRefresher";
import HeaderNavigation from "../components/HeaderNavigation";
import ServiceWorkerRegistrar from "../components/ServiceWorkerRegistrar";
import "../styles/globals.css";
import { DailyAvailabilityProvider } from "../hooks/useDailyAvailability";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.SITE_URL ??
  "http://localhost:3000";

const metadataBase = (() => {
  try {
    return new URL(siteUrl);
  } catch {
    return new URL("http://localhost:3000");
  }
})();

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: "GuessSenpai",
    template: "%s · GuessSenpai",
  },
  description:
    "Daily anime puzzles. Play Anidle, Poster, and more with GuessSenpai.",
  applicationName: "GuessSenpai",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GuessSenpai",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.svg", type: "image/svg+xml", sizes: "192x192" },
      { url: "/icons/icon-512.svg", type: "image/svg+xml", sizes: "512x512" },
    ],
    apple: "/icons/icon-192.svg",
    shortcut: "/icons/icon-192.svg",
    other: [{ rel: "mask-icon", url: "/icons/maskable-icon.svg" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#171819",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased selection:bg-[#ff7658] selection:text-[#27110b]">
        <SessionRefresher />
        <ServiceWorkerRegistrar />
        <DailyAvailabilityProvider>
          <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-4 sm:px-6 lg:px-10">
            <a href="#main-content" className="skip-link">
              Skip to content
            </a>
            <header className="mb-5 flex items-center justify-between border-b border-[#484b4d] py-3 text-sm text-[#c1c2bd]">
              <Link
                href="/"
                className="text-xl font-display font-bold tracking-tight text-[#f4f0e7] transition hover:text-[#ff987f]"
              >
                Guess<span className="text-brand-300">Senpai</span>
              </Link>
              <HeaderNavigation archiveDate={today} />
            </header>
            <main id="main-content" tabIndex={-1} className="flex-1 pb-10">
              {children}
            </main>
            <footer className="mt-8 border-t border-[#484b4d] pt-4 text-xs text-[#b8bbb7]">
              <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-neutral-500">
                  © {new Date().getFullYear()} GuessSenpai · Built with AniList
                  &amp; AnimeThemes data.
                </span>
                <a
                  href="mailto:support@guessenpai.app"
                  className="text-neutral-500 transition hover:text-[#c1c2bd]"
                >
                  support@guessenpai.app
                </a>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <Link
                    href="/games"
                    className="text-neutral-400 hover:text-white"
                  >
                    All games
                  </Link>
                  <Link
                    href="/how-to-play"
                    className="text-neutral-400 hover:text-white"
                  >
                    How to play
                  </Link>
                  <Link
                    href="/account"
                    className="text-neutral-400 hover:text-white"
                  >
                    Account
                  </Link>
                </div>
              </div>
            </footer>
          </div>
        </DailyAvailabilityProvider>
      </body>
    </html>
  );
}
