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
    <section className="relative overflow-hidden rounded-4xl border border-white/15 bg-white/10 p-8 text-white shadow-ambient backdrop-blur-2xl">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-500/20 via-purple-500/15 to-amber-400/15" />
      <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
            Daily streak secured
          </p>
          <h2 className="text-2xl font-display font-semibold tracking-tight sm:text-[2rem]">
            You’ve cleared today’s challenge
          </h2>
          <p className="max-w-xl text-sm text-neutral-100/85 sm:text-base">
            Bask in the victory glow or keep the brain warmed up in the archive while the next lineup gets ready.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <Link
            href="/archive"
            className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-brand-500 via-purple-500 to-pink-500 px-6 py-3 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.01] hover:shadow-[0_0_28px_rgba(147,51,234,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
          >
            Browse the archive
          </Link>
          <span
            className={classNames(
              "inline-flex min-w-[16rem] items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold uppercase tracking-[0.25em] text-white/85",
              "shadow-ambient"
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
