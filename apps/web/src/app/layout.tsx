import type { Metadata, Viewport } from "next";

import SessionRefresher from "../components/SessionRefresher";
import PrimaryNav from "../components/PrimaryNav";
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
      <body className="min-h-screen antialiased selection:bg-signal selection:text-signal-ink">
        <SessionRefresher />
        <ServiceWorkerRegistrar />
        <DailyAvailabilityProvider>
          <a href="#main-content" className="skip-link">
            Skip to content
          </a>
          <div className="min-h-screen md:flex">
            <PrimaryNav archiveDate={today} />
            <div className="flex min-w-0 flex-1 flex-col">
              <main
                id="main-content"
                tabIndex={-1}
                className="mx-auto w-full max-w-5xl flex-1 px-4 pb-10 pt-5 sm:px-6 md:pt-8 lg:px-10"
              >
                {children}
              </main>
              <footer className="mx-auto w-full max-w-5xl border-t border-line px-4 py-4 text-sm text-muted sm:px-6 lg:px-10">
                <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    © {new Date().getFullYear()} GuessSenpai · Built with
                    AniList &amp; AnimeThemes data.
                  </span>
                  <a
                    href="mailto:support@guessenpai.app"
                    className="inline-flex min-h-11 items-center hover:text-paper"
                  >
                    support@guessenpai.app
                  </a>
                </div>
              </footer>
            </div>
          </div>
        </DailyAvailabilityProvider>
      </body>
    </html>
  );
}
