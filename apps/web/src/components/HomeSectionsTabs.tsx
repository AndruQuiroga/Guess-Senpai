"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";

function classNames(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

type HomeSectionsTabsProps = {
  todayPanel: ReactNode;
  upcomingPanel: ReactNode;
  archivePanel?: ReactNode;
};

type TabId = "today" | "upcoming" | "archive";

type TabDefinition = {
  id: TabId;
  label: string;
  content: ReactNode;
};

function DefaultArchivePanel(): JSX.Element {
  return (
    <div className="flex h-full flex-col justify-between gap-6 rounded-4xl border border-white/10 bg-white/5 p-8 text-neutral-100/90 shadow-ambient">
      <div className="space-y-3">
        <h3 className="text-xl font-semibold text-white">
          Quick archive access
        </h3>
        <p className="text-sm leading-relaxed text-neutral-300">
          Catch up on earlier lineups, revisit your favorite runs, or see what
          you missed. The archive keeps every daily drop ready for another
          play-through.
        </p>
        <ul className="space-y-2 text-sm text-neutral-200">
          <li className="flex items-start gap-2">
            <span
              aria-hidden
              className="mt-1.5 inline-flex h-2.5 w-2.5 rounded-full bg-brand-400"
            />
            <span>Browse every puzzle set sorted by release date.</span>
          </li>
          <li className="flex items-start gap-2">
            <span
              aria-hidden
              className="mt-1.5 inline-flex h-2.5 w-2.5 rounded-full bg-purple-400"
            />
            <span>
              Replay completed days without touching your active streak.
            </span>
          </li>
        </ul>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/archive"
          className="inline-flex items-center gap-2 rounded-3xl border border-white/20 bg-brand-500/90 px-5 py-2.5 text-sm font-semibold text-white transition hover:scale-[1.01] hover:border-white/40 hover:bg-brand-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/75"
        >
          Open archive
          <svg
            aria-hidden
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M7.293 4.707a1 1 0 011.414-1.414l5.586 5.586a1 1 0 010 1.414l-5.586 5.586a1 1 0 01-1.414-1.414L11.172 10 7.293 6.121a1 1 0 010-1.414z" />
          </svg>
        </Link>
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-400">
          New sessions unlock every midnight PT
        </p>
      </div>
    </div>
  );
}

export function HomeSectionsTabs({
  todayPanel,
  upcomingPanel,
  archivePanel,
}: HomeSectionsTabsProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabId>("today");
  const baseId = useId();

  const tabs: TabDefinition[] = [
    { id: "today", label: "Today", content: todayPanel },
    { id: "upcoming", label: "Upcoming", content: upcomingPanel },
    {
      id: "archive",
      label: "Archive",
      content: archivePanel ?? <DefaultArchivePanel />,
    },
  ];

  return (
    <div className="flex min-h-0 flex-col gap-6">
      <div
        role="tablist"
        aria-label="Home sections"
        className="flex flex-wrap items-center gap-3"
      >
        {tabs.map((tab) => {
          const tabId = `${baseId}-${tab.id}`;
          return (
            <button
              key={tab.id}
              id={tabId}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`${tabId}-panel`}
              onClick={() => setActiveTab(tab.id)}
              className={classNames(
                "inline-flex items-center gap-2 rounded-3xl border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80",
                activeTab === tab.id
                  ? "border-white/40 bg-white/15 text-white shadow-[0_12px_24px_-16px_rgba(236,72,153,0.55)]"
                  : "border-white/10 bg-white/5 text-white/70 hover:border-white/25 hover:text-white",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="relative flex-1">
        {tabs.map((tab) => {
          const tabId = `${baseId}-${tab.id}`;
          return (
            <div
              key={tab.id}
              id={`${tabId}-panel`}
              role="tabpanel"
              aria-labelledby={tabId}
              hidden={activeTab !== tab.id}
              className="flex h-full flex-col gap-6"
            >
              {tab.content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
