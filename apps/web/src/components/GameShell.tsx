"use client";

import { usePathname } from "next/navigation";
import {
  PropsWithChildren,
  ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { findGameConfig, GAMES_DIRECTORY } from "../config/games";

interface GameShellProps {
  title: string;
  /**
   * Optional slot for the game's own progress (e.g. "Guess 3 / 8"). The shell
   * renders nothing here by default.
   */
  status?: ReactNode;
  /** Rules source. Defaults to the config entry for the route slug or title. */
  slug?: string;
  /** Replaces the rules list shown behind the "?" button. */
  rules?: string[];
}

function useRules(title: string, slug?: string, rules?: string[]) {
  const pathname = usePathname() ?? "";
  if (rules) return { summary: undefined, rules };
  const routeSlug = slug ?? pathname.split("/").filter(Boolean)[1];
  const entry =
    (routeSlug ? findGameConfig(routeSlug) : undefined) ??
    GAMES_DIRECTORY.find((game) => game.title === title);
  return { summary: entry?.preview.summary, rules: entry?.preview.rules ?? [] };
}

export function GameShell({
  title,
  status,
  slug,
  rules,
  children,
}: PropsWithChildren<GameShellProps>) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const content = useRules(title, slug, rules);
  const hasRules = Boolean(content.summary) || content.rules.length > 0;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <section className="game-shell flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-3xl font-bold tracking-tight text-paper">
            {title}
          </h1>
          {hasRules ? (
            <button
              ref={buttonRef}
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              aria-label={`How to play ${title}`}
              onClick={() => setOpen((value) => !value)}
              className={`inline-flex h-11 w-11 items-center justify-center rounded-full border text-lg font-bold transition ${
                open
                  ? "border-signal bg-panel-raised text-paper"
                  : "border-line-strong text-muted hover:bg-hover hover:text-paper"
              }`}
            >
              <span aria-hidden="true">?</span>
            </button>
          ) : null}
        </div>
        {status ? (
          <div className="text-base font-semibold text-muted">{status}</div>
        ) : null}
      </header>
      {hasRules ? (
        <div
          id={panelId}
          hidden={!open}
          className="panel space-y-3 p-4 text-base text-muted"
        >
          {content.summary ? <p>{content.summary}</p> : null}
          {content.rules.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5">
              {content.rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <div className="flex-1 space-y-5">{children}</div>
    </section>
  );
}
