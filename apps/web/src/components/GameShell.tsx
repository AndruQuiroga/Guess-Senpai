"use client";

import { PropsWithChildren } from "react";

interface GameShellProps {
  title: string;
  round: number;
  totalRounds: number;
  actions?: React.ReactNode;
  roundLabel?: string;
}

export function GameShell({
  title,
  round,
  totalRounds,
  actions,
  roundLabel,
  children,
}: PropsWithChildren<GameShellProps>) {
  return (
    <section className="game-shell panel relative flex flex-col overflow-visible p-4 sm:p-6">
      <header className="mb-5 flex flex-col gap-3 border-b border-[#484b4d] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold tracking-tight text-[#f4f0e7]">
            {title}
          </h2>
          <div className="mt-2 flex items-center gap-2 text-sm text-[#c1c2bd]">
            <span className="rounded-md border border-[#686b6d] bg-[#2c2f31] px-3 py-1 font-semibold text-[#f4f0e7]">
              {roundLabel ?? "Round"} {round} / {totalRounds}
            </span>
          </div>
        </div>
        {actions ? (
          <div className="flex items-center gap-2 text-sm text-[#c1c2bd]">
            {actions}
          </div>
        ) : null}
      </header>
      <div className="flex-1 space-y-5">{children}</div>
      <div
        className="mt-5 h-1 w-full overflow-hidden rounded-full bg-[#484b4d]"
        aria-hidden="true"
      >
        <div
          className="h-full bg-[#ff7658] transition-all duration-300"
          style={{ width: `${(round / totalRounds) * 100}%` }}
        />
      </div>
    </section>
  );
}
