"use client";

import Link from "next/link";

const games = [
  {
    title: "Daily Puzzles",
    description: "Play all three anime challenges — Anidle, Poster Zoomed, and Redacted Synopsis — refreshed every midnight.",
    href: "/games/daily",
    eyebrow: "New every day",
  },
  {
    title: "Archive",
    description: "Catch up on previous days you missed and see how fast you can solve past lineups of GuessSenpai puzzles.",
    href: "/archive",
    eyebrow: "Missed a day?",
  },
  {
    title: "How to Play",
    description: "Learn strategies and the rules behind each puzzle mode so you can climb the leaderboard and keep your streak alive.",
    href: "/how-to-play",
    eyebrow: "Need a refresher?",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-16">
      <section className="relative overflow-hidden rounded-4xl border border-white/10 bg-surface-raised p-10 text-white shadow-ambient backdrop-blur-2xl sm:p-16">
        <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-brand-400/60 to-transparent" />
        <div className="relative z-10 max-w-3xl space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-neutral-100/80">
            GuessSenpai
          </span>
          <h1 className="text-4xl font-display font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Anime guessing games with a glassy twist
          </h1>
          <p className="text-lg leading-relaxed text-neutral-200">
            Sharpen your encyclopedic knowledge of anime through daily rounds of metadata, posters, synopsis reveals, and a dash
            of musical nostalgia. Compete with friends, maintain your streak, and share your victories.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/games/daily"
              className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-brand-500 via-purple-500 to-pink-500 px-6 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.01] hover:shadow-[0_0_28px_rgba(147,51,234,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
            >
              Play today&apos;s puzzles
            </Link>
            <Link
              href="/how-to-play"
              className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-6 py-2.5 text-sm font-semibold text-white/90 shadow-ambient transition hover:border-brand-400/40 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
            >
              Learn the rules
            </Link>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/3 bg-gradient-to-l from-brand-500/40 via-purple-500/20 to-transparent blur-3xl sm:block" />
      </section>

      <section className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-display font-semibold tracking-tight text-white">Choose your game</h2>
          <p className="text-sm text-neutral-300">Jump into today&apos;s lineup or revisit past challenges.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {games.map((game) => (
            <Link
              key={game.href}
              href={game.href}
              className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-surface-raised/80 p-6 text-white shadow-ambient backdrop-blur-xl transition hover:border-brand-400/50 hover:shadow-[0_0_40px_rgba(59,130,246,0.35)]"
            >
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-500/0 via-brand-500/5 to-purple-500/20 opacity-0 transition group-hover:opacity-100" />
              <div className="relative z-10 flex flex-1 flex-col gap-4">
                <span className="inline-flex w-fit items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-neutral-200/80">
                  {game.eyebrow}
                </span>
                <h3 className="text-xl font-display font-semibold tracking-tight">{game.title}</h3>
                <p className="text-sm leading-relaxed text-neutral-200">{game.description}</p>
              </div>
              <span className="relative z-10 mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-200 transition group-hover:text-brand-100">
                Start playing
                <svg
                  aria-hidden
                  className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M7.293 4.707a1 1 0 011.414-1.414l5.586 5.586a1 1 0 010 1.414l-5.586 5.586a1 1 0 01-1.414-1.414L11.172 10 7.293 6.121a1 1 0 010-1.414z" />
                </svg>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
