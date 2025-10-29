"use client";

import { PropsWithChildren, useEffect } from "react";

interface GameShellProps {
  title: string;
  round: number;
  totalRounds: number;
  onJumpRound?: (round: number) => void;
  actions?: React.ReactNode;
  roundLabel?: string;
}

export function GameShell({
  title,
  round,
  totalRounds,
  onJumpRound,
  actions,
  roundLabel,
  children,
}: PropsWithChildren<GameShellProps>) {
  useEffect(() => {
    if (!onJumpRound) return;
    const allowedKeys = new Set(Array.from({ length: totalRounds }, (_, idx) => String(idx + 1)));
    const handler = (event: KeyboardEvent) => {
      if (!allowedKeys.has(event.key)) return;
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) {
        return;
      }
      const value = Number.parseInt(event.key, 10);
      if (Number.isNaN(value)) return;
      if (value >= 1 && value <= totalRounds) {
        onJumpRound(value);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onJumpRound, totalRounds]);

  return (
    <section className="relative flex min-h-[60vh] flex-col overflow-hidden rounded-3xl border border-white/10 bg-surface-raised p-6 shadow-ambient backdrop-blur-2xl transition hover:border-brand-400/30 hover:shadow-glow">
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-brand-400/70 to-transparent" />
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-display font-semibold tracking-tight text-white drop-shadow-[0_0_12px_rgba(59,130,246,0.35)]">
            {title}
          </h2>
          <div className="mt-2 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-brand-200/80">
            <span className="rounded-full border border-brand-400/60 bg-brand-500/10 px-3 py-1 text-[0.65rem] font-semibold text-brand-200">
              {roundLabel ?? "Round"} {round} / {totalRounds}
            </span>
            <span className="hidden text-[0.65rem] text-neutral-500 sm:inline">Press 1 • 2 • 3 to jump rounds</span>
          </div>
        </div>
        {actions ? <div className="flex items-center gap-2 text-sm text-neutral-300">{actions}</div> : null}
      </header>
      <div className="flex-1 space-y-5">{children}</div>
      <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-400 via-brand-500 to-brand-300 transition-all duration-500"
          style={{ width: `${(round / totalRounds) * 100}%` }}
        />
      </div>
    </section>
  );
}
