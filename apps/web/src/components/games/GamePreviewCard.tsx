"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { PropsWithChildren, ReactNode } from "react";

import { useCelebration } from "../../hooks/useCelebration";

export type GameProgressStatus = "not-started" | "in-progress" | "completed";

interface GamePreviewCardProps {
  slug: string;
  title: string;
  description?: string;
  status: GameProgressStatus;
  statusLabel: string;
  statusIcon: string;
  accentColor: string;
  ctaLabel: string;
  href: string;
  index: number;
  preview?: ReactNode;
}

const STATUS_TONES: Record<GameProgressStatus, string> = {
  "not-started": "text-neutral-300",
  "in-progress": "text-amber-200",
  completed: "text-emerald-200",
};

const STATUS_OUTLINES: Record<GameProgressStatus, string> = {
  "not-started": "border-white/15 bg-white/5",
  "in-progress": "border-amber-300/40 bg-amber-500/15",
  completed: "border-emerald-300/50 bg-emerald-500/15",
};

function PreviewPanel({ children }: PropsWithChildren) {
  if (!children) {
    return (
      <p className="text-sm text-neutral-300/90">
        First-round hints unlock as soon as you start playing.
      </p>
    );
  }

  return <div className="space-y-3 text-sm text-neutral-100/90">{children}</div>;
}

export function GamePreviewCard({
  slug,
  title,
  description,
  status,
  statusLabel,
  statusIcon,
  accentColor,
  ctaLabel,
  href,
  index,
  preview,
}: GamePreviewCardProps) {
  const isCelebrating = useCelebration(status);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
      transition={{ duration: 0.45, delay: index * 0.06, ease: [0.25, 0.1, 0.25, 1] }}
      className="relative pl-10 sm:pl-14"
    >
      <motion.span
        layout
        className={`absolute left-[0.35rem] top-6 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full text-base font-semibold text-white shadow-[0_0_12px_rgba(59,130,246,0.4)] ${STATUS_OUTLINES[status]}`}
        animate={
          isCelebrating
            ? { scale: [1, 1.18, 1], rotate: [0, -3, 3, 0] }
            : { scale: 1, rotate: 0 }
        }
        transition={{
          duration: isCelebrating ? 1.2 : 0.4,
          repeat: isCelebrating ? 2 : 0,
          ease: "easeInOut",
        }}
        aria-hidden
      >
        {statusIcon}
      </motion.span>

      <motion.div
        layout
        className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 shadow-ambient transition focus-within:border-white/30 focus-within:shadow-glow sm:p-6 ${
          isCelebrating ? "border-emerald-300/60 shadow-glow" : "hover:border-white/20"
        }`}
      >
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accentColor} opacity-0 transition duration-500 ${
            isCelebrating ? "opacity-40" : "group-hover:opacity-25"
          }`}
        />

        <div className="relative z-10 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-neutral-300">
                <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[0.6rem] text-neutral-200/90">
                  Daily puzzle
                </span>
                <span className={STATUS_TONES[status]}>{statusLabel}</span>
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-display font-semibold tracking-tight text-white sm:text-2xl">
                  {title}
                </h2>
                {description ? (
                  <p className="text-sm leading-relaxed text-neutral-200/90">{description}</p>
                ) : null}
              </div>
            </div>

            <AnimatePresence>
              {isCelebrating ? (
                <motion.span
                  key={`${slug}-celebration`}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.4 }}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-300/50 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                >
                  🎉 Streak saved!
                </motion.span>
              ) : null}
            </AnimatePresence>
          </div>

          <PreviewPanel>{preview}</PreviewPanel>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">
              {status === "completed"
                ? "You cleared every round."
                : status === "in-progress"
                  ? "We saved your latest hint."
                  : "Tap in to reveal the first clue."}
            </p>

            <Link
              href={href}
              className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-brand-500 via-purple-500 to-pink-500 px-5 py-2 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.01] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
            >
              {ctaLabel}
            </Link>
          </div>
        </div>
      </motion.div>
    </motion.li>
  );
}

