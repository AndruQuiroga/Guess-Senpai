import type { Metadata } from "next";
import Link from "next/link";

import SessionRefresher from "../components/SessionRefresher";
import HeaderNavigation from "../components/HeaderNavigation";
import ServiceWorkerRegistrar from "../components/ServiceWorkerRegistrar";
import "../styles/globals.css";
import { DailyAvailabilityProvider } from "../hooks/useDailyAvailability";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? "http://localhost:3000";

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
    "Glassy daily anime guessing challenges. Play Anidle, Poster Zoomed, Redacted Synopsis, and more with streak tracking and shareable cards.",
  applicationName: "GuessSenpai",
  manifest: "/manifest.webmanifest",
  themeColor: "#8b5cf6",
  colorScheme: "dark",
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
    other: [
      { rel: "mask-icon", url: "/icons/maskable-icon.svg" },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <html lang="en" className="dark">
      <body className="relative min-h-screen text-neutral-100 antialiased selection:bg-brand-500/40 selection:text-white">
        <SessionRefresher />
        <ServiceWorkerRegistrar />
        <DailyAvailabilityProvider>
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
              <HeaderNavigation archiveDate={today} />
            </header>
            <main className="flex-1 pb-16">{children}</main>
            <footer className="mt-20 border-t border-white/10 pt-6 text-[11px] text-neutral-500">
              <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-neutral-500">
                  © {new Date().getFullYear()} GuessSenpai · Built with AniList &amp; AnimeThemes data.
                </span>
                <a
                  href="mailto:support@guessenpai.app"
                  className="text-neutral-500 transition hover:text-neutral-300"
                >
                  support@guessenpai.app
                </a>
              </div>
            </footer>
          </div>
        </DailyAvailabilityProvider>
      </body>
    </html>
  );
}
