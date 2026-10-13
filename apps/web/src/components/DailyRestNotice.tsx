import Link from "next/link";

export function DailyRestNotice(): JSX.Element {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <h3 className="text-lg font-semibold text-white">
          Today's lineup is complete
        </h3>
        <p className="text-sm text-[#c1c2bd]">
          Fresh rounds unlock with the daily reset—check back tomorrow for more.
        </p>
      </div>
      <article className="relative flex">
        <div className="relative flex h-full w-full flex-col gap-6 overflow-hidden rounded-lg border border-[#484b4d] bg-surface-raised p-8 text-white">
          <div className="relative z-10 flex min-h-[18rem] flex-col gap-6">
            <div className="space-y-4">
              <span className="inline-flex w-fit items-center gap-2 rounded-lg border border-[#686b6d] bg-[#2c2f31] px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-[#f4f0e7]">
                Daily rest
              </span>
              <h4 className="text-2xl font-display font-semibold tracking-tight text-white">
                We're buttoning up today's show
              </h4>
              <p className="max-w-xl text-sm leading-relaxed text-[#f4f0e7] sm:text-base">
                Every puzzle in today's schedule has wrapped. Swing back
                tomorrow for a brand-new lineup, or keep the momentum going by
                replaying past challenges in the archive.
              </p>
            </div>
            <div className="mt-auto">
              <Link
                href="/archive"
                className="group inline-flex items-center gap-2 rounded-lg border border-[#686b6d] bg-[#2c2f31] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.24em] text-[#f4f0e7] transition hover:border-[#686b6d] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
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
