import Link from "next/link";

import DailyResetTimer from "./DailyResetTimer";
import { LoginCallout } from "./LoginCallout";

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
    chunk.accent === "highlight" ? "bg-[#ff7658]" : "bg-[#2c2f31]";

  const wrapperClasses =
    layout === "inline"
      ? classNames(
          "inline-flex min-w-0 items-center gap-3 rounded-lg border border-[#484b4d] px-3 py-2 text-xs font-medium text-[#f4f0e7] sm:text-sm",
          gradientClasses,
        )
      : classNames(
          "inline-flex w-full min-w-[10rem] flex-1 items-center gap-4 rounded-lg border border-[#484b4d] px-4 py-3 text-left text-sm text-[#f4f0e7] transition-transform duration-200 ease-out sm:w-auto sm:text-base",
          gradientClasses,
        );

  const iconWrapperClasses = classNames(
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2c2f31] text-base text-white",
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
        "flex flex-wrap items-start gap-3 text-sm text-[#f4f0e7] sm:items-center sm:text-base",
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
  primaryCta?: HeroCta;
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
    <section className="relative overflow-hidden rounded-lg border border-[#484b4d] bg-surface-raised p-10 text-white sm:p-14">
      <div className="relative z-10 flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl space-y-5">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#686b6d] bg-[#2c2f31] px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-[#f4f0e7]">
            GuessSenpai
          </span>
          <h1 className="text-3xl font-display font-semibold tracking-tight sm:text-4xl lg:text-[2.75rem]">
            Your daily anime guess sprint
          </h1>
          <p className="text-base leading-relaxed text-[#c1c2bd] sm:text-lg">
            Guess the series, flex your trivia brain, and keep the streak alive.
            Track progress for {formattedDate} without leaving the fold.
          </p>
          {showLoginCallout ? (
            <LoginCallout className="max-w-xs sm:max-w-sm" />
          ) : null}
          {primaryCta || secondaryCta ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              {primaryCta ? (
                <Link
                  href={primaryCta.href}
                  className="inline-flex items-center justify-center rounded-lg border border-[#ff7658] bg-[#ff7658] hover:bg-[#ff8a70] px-7 py-3 text-base font-semibold text-[#27110b] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
                >
                  {primaryCta.label}
                </Link>
              ) : null}
              {secondaryCta ? (
                <Link
                  href={secondaryCta.href}
                  className="inline-flex items-center justify-center rounded-lg border border-[#686b6d] px-5 py-2.5 text-sm font-semibold text-[#f4f0e7] transition hover:border-[#686b6d] hover:text-white"
                >
                  {secondaryCta.label}
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="flex w-full max-w-lg flex-col gap-6 rounded-lg border border-[#686b6d] bg-[#242628] p-6 text-sm text-[#c1c2bd]">
          <div className="space-y-1 text-[#f4f0e7]">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#c1c2bd]">
              Today&apos;s progress
            </p>
            <p className="text-sm text-[#c1c2bd]">
              Streak {streakInfo.count} • {formattedDate}
            </p>
          </div>
          <DailyResetTimer timeRemaining={timeRemaining} />
          <ProgressSummary chunks={progressChunks} layout="pill" />
          {nextIncompleteGame ? (
            <p className="text-sm text-[#f4f0e7]">
              You left off on {nextIncompleteGame.title}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
