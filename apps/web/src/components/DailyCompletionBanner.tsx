import Link from "next/link";

interface DailyCompletionBannerProps {
  timeRemaining: string | null;
}

function classNames(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

export function DailyCompletionBanner({
  timeRemaining,
}: DailyCompletionBannerProps): JSX.Element {
  const countdownLabel = timeRemaining ?? "--:--:--";

  return (
    <section className="relative overflow-hidden rounded-lg border border-[#686b6d] bg-[#2c2f31] p-8 text-white">
      <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#f4f0e7]">
            Daily streak secured
          </p>
          <h2 className="text-2xl font-display font-semibold tracking-tight sm:text-[2rem]">
            You’ve cleared today’s challenge
          </h2>
          <p className="max-w-xl text-sm text-[#f4f0e7] sm:text-base">
            Bask in the victory glow or keep the brain warmed up in the archive
            while the next lineup gets ready.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <Link
            href="/archive"
            className="inline-flex items-center justify-center rounded-lg border border-[#ff7658] bg-[#ff7658] hover:bg-[#ff8a70] px-6 py-3 text-sm font-semibold text-[#27110b] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
          >
            Browse the archive
          </Link>
          <span
            className={classNames(
              "inline-flex min-w-[16rem] items-center justify-center rounded-lg border border-[#686b6d] bg-[#2c2f31] px-5 py-3 text-sm font-semibold uppercase tracking-[0.25em] text-[#f4f0e7]",
              "",
            )}
            aria-live="polite"
          >
            Next lineup in {countdownLabel}
          </span>
        </div>
      </div>
    </section>
  );
}

export default DailyCompletionBanner;
