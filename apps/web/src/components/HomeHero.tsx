import Link from "next/link";

import DailyResetTimer from "./DailyResetTimer";

export type ProgressSummaryChunk = {
  id: "streak" | "completion";
  icon: string;
  text: string;
  textClassName?: string;
  accent?: "highlight" | "neutral";
};

export type StreakSummary = {
  count: number;
  lastCompleted: string | null;
};

export type HeroCta = {
  href: string;
  label: string;
};

function classNames(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

function ProgressSummaryChip({
  chunk,
  layout = "inline",
}: {
  chunk: ProgressSummaryChunk;
  layout?: "inline" | "pill";
}): JSX.Element {
  const gradientClasses =
    chunk.accent === "highlight"
      ? "from-brand-500/90 via-purple-500/80 to-amber-400/85"
      : "from-white/15 via-white/10 to-white/5";

  const wrapperClasses =
    layout === "inline"
      ? classNames(
          "inline-flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-gradient-to-br px-3 py-2 text-xs font-medium text-white/90 shadow-ambient sm:text-sm",
          `bg-gradient-to-br ${gradientClasses}`,
        )
      : classNames(
          "inline-flex w-full min-w-[10rem] flex-1 items-center gap-4 rounded-3xl border border-white/10 bg-gradient-to-br px-4 py-3 text-left text-sm text-white/95 shadow-ambient transition-transform duration-200 ease-out sm:w-auto sm:text-base",
          `bg-gradient-to-br ${gradientClasses}`,
        );

  const iconWrapperClasses = classNames(
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-base text-white",
    layout === "pill" && "h-10 w-10 text-lg",
  );

  const labelClasses = classNames(
    "truncate",
    layout === "pill" && "font-semibold",
    chunk.textClassName,
  );

  return (
    <span className={wrapperClasses}>
      <span aria-hidden className={iconWrapperClasses}>
        {chunk.icon}
      </span>
      <span className={labelClasses}>{chunk.text}</span>
    </span>
  );
}

function ProgressSummary({
  chunks,
  className,
  layout = "inline",
}: {
  chunks: ProgressSummaryChunk[];
  className?: string;
  layout?: "inline" | "pill";
}): JSX.Element {
  return (
    <div
      className={classNames(
        "flex flex-wrap items-start gap-3 text-sm text-white/90 sm:items-center sm:text-base",
        className,
      )}
    >
      {chunks.map((chunk) => (
        <ProgressSummaryChip key={chunk.id} chunk={chunk} layout={layout} />
      ))}
    </div>
  );
}

interface HomeHeroProps {
  formattedDate: string;
  streakInfo: StreakSummary;
  progressChunks: ProgressSummaryChunk[];
  showLoginCallout: boolean;
  primaryCta: HeroCta;
  secondaryCta?: HeroCta;
  nextIncompleteGame: { slug: string; title: string } | null;
  timeRemaining: string | null;
}

export function HomeHero({
  formattedDate,
  streakInfo,
  progressChunks,
  showLoginCallout,
  primaryCta,
  secondaryCta,
  nextIncompleteGame,
  timeRemaining,
}: HomeHeroProps): JSX.Element {
  return (
    <section className="relative overflow-hidden rounded-4xl border border-white/10 bg-surface-raised p-10 text-white shadow-ambient backdrop-blur-2xl sm:p-14">
      <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-brand-400/60 to-transparent" />
      <div className="relative z-10 flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl space-y-5">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-neutral-100/80">
            GuessSenpai
          </span>
          <h1 className="text-3xl font-display font-semibold tracking-tight sm:text-4xl lg:text-[2.75rem]">
            Your daily anime guess sprint
          </h1>
          <p className="text-base leading-relaxed text-neutral-200/90 sm:text-lg">
            Guess the series, flex your trivia brain, and keep the streak alive.
            Track progress for {formattedDate} without leaving the fold.
          </p>
          {showLoginCallout ? (
            <p className="text-sm leading-relaxed text-neutral-200/80">
              <Link
                href="/login"
                className="font-semibold text-white transition hover:text-brand-200"
              >
                Log in with AniList
              </Link>{" "}
              to sync your streaks and archive completions across every device.
            </p>
          ) : null}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            <Link
              href={primaryCta.href}
              className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-brand-500 via-purple-500 to-pink-500 px-7 py-3 text-base font-semibold text-white shadow-glow transition hover:scale-[1.01] hover:shadow-[0_0_28px_rgba(147,51,234,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
            >
              {primaryCta.label}
            </Link>
            {secondaryCta ? (
              <Link
                href={secondaryCta.href}
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-white/85 transition hover:border-white/40 hover:text-white"
              >
                {secondaryCta.label}
              </Link>
            ) : null}
          </div>
        </div>
        <div className="flex w-full max-w-lg flex-col gap-6 rounded-4xl border border-white/15 bg-white/5 p-6 text-sm text-neutral-200/90 shadow-ambient backdrop-blur-xl">
          <div className="space-y-1 text-white/85">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
              Today&apos;s progress
            </p>
            <p className="text-sm text-neutral-200/80">
              Streak {streakInfo.count} • {formattedDate}
            </p>
          </div>
          <DailyResetTimer timeRemaining={timeRemaining} />
          <ProgressSummary chunks={progressChunks} layout="pill" />
          {nextIncompleteGame ? (
            <p className="text-sm text-neutral-100/80">
              You left off on {nextIncompleteGame.title}
            </p>
          ) : null}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/3 bg-gradient-to-l from-brand-500/40 via-purple-500/20 to-transparent blur-3xl sm:block" />
    </section>
  );
}
