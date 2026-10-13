"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { PropsWithChildren, ReactNode } from "react";

import { useCelebration } from "../../hooks/useCelebration";

export type GameProgressStatus =
  | "not-started"
  | "in-progress"
  | "completed"
  | "exhausted";

interface GamePreviewCardProps {
  slug: string;
  title: string;
  description?: string;
  status: GameProgressStatus;
  statusLabel: string;
  statusIcon: string;
  /** Retained for API compatibility; matte cards no longer render accent glows. */
  accentColor?: string;
  ctaLabel: string;
  href: string;
  index: number;
  preview?: ReactNode;
}

const STATUS_TONES: Record<GameProgressStatus, string> = {
  "not-started": "text-[#c1c2bd]",
  "in-progress": "text-[#f2c36b]",
  completed: "text-[#9fd8b0]",
  exhausted: "text-[#ff987f]",
};

const STATUS_OUTLINES: Record<GameProgressStatus, string> = {
  "not-started": "border-[#686b6d] bg-[#2c2f31]",
  "in-progress": "border-[#f2c36b] bg-[#2c2f31]",
  completed: "border-[#9fd8b0] bg-[#2c2f31]",
  exhausted: "border-[#ff987f] bg-[#2c2f31]",
};

const STATUS_FOOTNOTES: Record<GameProgressStatus, string> = {
  completed: "You cleared every round.",
  exhausted: "Out of guesses. The answer is revealed.",
  "in-progress": "We saved your latest hint.",
  "not-started": "Open the puzzle to reveal the first clue.",
};

function PreviewPanel({ children }: PropsWithChildren) {
  if (!children) {
    return (
      <p className="text-sm text-[#c1c2bd]">
        First-round hints unlock as soon as you start playing.
      </p>
    );
  }

  return <div className="space-y-3 text-sm text-[#f4f0e7]">{children}</div>;
}

export function GamePreviewCard({
  slug,
  title,
  description,
  status,
  statusLabel,
  statusIcon,
  ctaLabel,
  href,
  index,
  preview,
}: GamePreviewCardProps) {
  const isCelebrating = useCelebration(status);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25, delay: index * 0.04, ease: "easeOut" }}
      className="relative pl-10 sm:pl-14"
    >
      <motion.span
        layout
        className={`absolute left-[0.35rem] top-6 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border text-base font-semibold text-[#f4f0e7] ${STATUS_OUTLINES[status]}`}
        animate={isCelebrating ? { scale: [1, 1.12, 1] } : { scale: 1 }}
        transition={{
          duration: isCelebrating ? 0.8 : 0.3,
          repeat: isCelebrating ? 1 : 0,
          ease: "easeInOut",
        }}
        aria-hidden
      >
        {statusIcon}
      </motion.span>

      <motion.div
        layout
        className={`relative overflow-hidden rounded-lg border bg-[#242628] p-5 transition-colors focus-within:border-[#ff987f] sm:p-6 ${
          isCelebrating
            ? "border-[#9fd8b0]"
            : "border-[#484b4d] hover:border-[#686b6d]"
        }`}
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#c1c2bd]">
                <span className="rounded-md border border-[#484b4d] bg-[#2c2f31] px-2 py-1 text-[0.7rem] text-[#f4f0e7]">
                  Daily puzzle
                </span>
                <span className={STATUS_TONES[status]}>{statusLabel}</span>
              </div>
              <div className="space-y-2">
                <h2 className="font-display text-xl font-semibold tracking-tight text-[#f4f0e7] sm:text-2xl">
                  {title}
                </h2>
                {description ? (
                  <p className="text-sm leading-relaxed text-[#c1c2bd]">
                    {description}
                  </p>
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
                  transition={{ duration: 0.3 }}
                  className="inline-flex items-center gap-2 rounded-md border border-[#9fd8b0] bg-[#2c2f31] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#9fd8b0]"
                >
                  Streak saved
                </motion.span>
              ) : null}
            </AnimatePresence>
          </div>

          <PreviewPanel>{preview}</PreviewPanel>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[#c1c2bd]">{STATUS_FOOTNOTES[status]}</p>

            <Link href={href} className="button button-primary">
              {ctaLabel}
            </Link>
          </div>
        </div>
      </motion.div>
    </motion.li>
  );
}
