import Link from "next/link";

export function DailyRestNotice(): JSX.Element {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <h3 className="text-lg font-semibold text-white">
          Today's lineup is complete
        </h3>
        <p className="text-sm text-neutral-300/90">
          Fresh rounds unlock with the daily reset—check back tomorrow for more.
        </p>
      </div>
      <article className="relative flex">
        <div className="relative flex h-full w-full flex-col gap-6 overflow-hidden rounded-4xl border border-white/10 bg-surface-raised/70 p-8 text-white shadow-ambient backdrop-blur-2xl">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/5 via-brand-500/10 to-purple-500/10 mix-blend-screen" aria-hidden />
          <div className="relative z-10 flex min-h-[18rem] flex-col gap-6">
            <div className="space-y-4">
              <span className="inline-flex w-fit items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-white/80">
                Daily rest
              </span>
              <h4 className="text-2xl font-display font-semibold tracking-tight text-white">
                We're buttoning up today's show
              </h4>
              <p className="max-w-xl text-sm leading-relaxed text-neutral-100/85 sm:text-base">
                Every puzzle in today's schedule has wrapped. Swing back tomorrow for a brand-new lineup, or keep the momentum going by replaying past challenges in the archive.
              </p>
            </div>
            <div className="mt-auto">
              <Link
                href="/archive"
                className="group inline-flex items-center gap-2 rounded-3xl border border-white/15 bg-white/10 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.24em] text-white/85 transition hover:border-white/25 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
              >
                Browse the archive
                <svg
                  aria-hidden
                  className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M7.293 4.707a1 1 0 011.414-1.414l5.586 5.586a1 1 0 010 1.414l-5.586 5.586a1 1 0 01-1.414-1.414L11.172 10 7.293 6.121a1 1 0 010-1.414z" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}

export default DailyRestNotice;
