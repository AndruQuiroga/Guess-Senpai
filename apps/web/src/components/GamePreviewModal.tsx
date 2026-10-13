"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { GameDirectoryEntry, resolveGameAvailability } from "../config/games";
import { useDailyAvailability } from "../hooks/useDailyAvailability";
import { GameProgress } from "../types/progress";
import { getGameOutcome } from "../utils/gameAction";
import { Dialog } from "./ui/Primitives";

type PrimaryAction = {
  label: string;
  href: string | null;
  disabled: boolean;
};

interface GamePreviewModalProps {
  open: boolean;
  game: GameDirectoryEntry | null;
  onClose: () => void;
  progress?: GameProgress;
}

const FOCUSABLE_SELECTORS =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function GamePreviewModal({
  open,
  game,
  onClose,
  progress,
}: GamePreviewModalProps) {
  const [mounted, setMounted] = useState(false);
  const [rulesExpanded, setRulesExpanded] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const { guessTheOpeningEnabled, error, refresh, loading } =
    useDailyAvailability();
  const showAvailabilityError = error;
  const handleRetry = useCallback(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setRulesExpanded(false);
    }
  }, [open]);

  useEffect(() => {
    setRulesExpanded(false);
  }, [game?.slug]);

  useEffect(() => {
    if (!open) return;
    openerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const focusTarget = closeButtonRef.current;
    focusTarget?.focus({ preventScroll: true });
    const mainContent = document.getElementById("main-content");
    const wasInert = mainContent?.inert ?? false;
    if (mainContent) mainContent.inert = true;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable =
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (mainContent) mainContent.inert = wasInert;
      openerRef.current?.focus({ preventScroll: true });
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const target = closeButtonRef.current;
    target?.focus({ preventScroll: true });
  }, [open]);

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const runtimeGame = useMemo(() => {
    if (!game) {
      return null;
    }
    return resolveGameAvailability(game, { guessTheOpeningEnabled });
  }, [game, guessTheOpeningEnabled]);
  const availabilityErrorForGame =
    showAvailabilityError && runtimeGame?.slug === "guess-the-opening";

  const primaryAction = useMemo<PrimaryAction | null>(() => {
    if (!runtimeGame || availabilityErrorForGame) return null;
    if (!runtimeGame.playable) {
      return {
        label: "Coming soon",
        href: null,
        disabled: true,
      };
    }

    const href = `/games/${runtimeGame.slug}`;
    const outcome = getGameOutcome(progress);
    if (outcome === "solved") {
      return { label: "View completed round", href, disabled: false };
    }
    if (outcome === "exhausted") {
      return { label: "View results", href, disabled: false };
    }
    if (progress) {
      return { label: "Resume game", href, disabled: false };
    }
    return { label: "Start playing", href, disabled: false };
  }, [availabilityErrorForGame, progress, runtimeGame]);
  const showDemoNotice =
    runtimeGame?.playable && !progress && !availabilityErrorForGame;

  if (!mounted || !open || !runtimeGame) {
    return null;
  }

  const titleId = `game-preview-title-${runtimeGame.slug}`;
  const descriptionId = `game-preview-description-${runtimeGame.slug}`;
  const media = runtimeGame.preview.media;
  const placeholder = runtimeGame.preview.placeholder;

  const rules = runtimeGame.preview.rules;
  const firstRule = rules[0];
  const remainingRules = rules.slice(1);
  const hasAdditionalRules = remainingRules.length > 0;

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 sm:px-6">
      <div
        className="absolute inset-0 bg-black/75"
        onClick={handleBackdropClick}
      />
      <Dialog
        dialogRef={dialogRef}
        labelledBy={titleId}
        describedBy={descriptionId}
        className="relative z-10 max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto overscroll-contain rounded-lg border border-line bg-panel text-paper"
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-line bg-panel-raised text-paper transition hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
          aria-label="Close preview"
        >
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            className="h-4 w-4"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 011.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        <div className="grid gap-6 p-6 sm:grid-cols-[1.1fr_0.9fr] sm:gap-8 sm:p-8">
          <div className="space-y-6">
            <section className="space-y-3">
              <span className="inline-flex w-fit items-center rounded-full border border-line-strong bg-panel px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-muted">
                {runtimeGame.playable
                  ? "Featured game"
                  : runtimeGame.comingSoon
                    ? "In development"
                    : "Unavailable"}
              </span>
              <div className="space-y-2">
                <h2
                  id={titleId}
                  className="text-2xl font-display font-semibold tracking-tight sm:text-3xl"
                >
                  {runtimeGame.title}
                </h2>
                <p className="text-sm uppercase tracking-[0.3em] text-muted">
                  {runtimeGame.tagline}
                </p>
              </div>
              <p
                id={descriptionId}
                className="text-base leading-relaxed text-muted"
              >
                {runtimeGame.preview.summary}
              </p>
            </section>

            <section className="space-y-3 border-t border-line pt-6">
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                  How to play
                </h3>
                {hasAdditionalRules ? (
                  <button
                    type="button"
                    onClick={() => setRulesExpanded((current) => !current)}
                    aria-expanded={rulesExpanded}
                    className="text-xs font-semibold uppercase tracking-[0.28em] text-paper transition hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
                  >
                    {rulesExpanded
                      ? "Hide details"
                      : `Show ${remainingRules.length} more`}
                  </button>
                ) : null}
              </div>
              <ul className="space-y-2 text-sm leading-relaxed text-muted">
                {firstRule ? (
                  <li className="relative rounded-lg border border-line bg-panel px-4 py-3 text-paper">
                    {firstRule}
                  </li>
                ) : null}
                {rulesExpanded
                  ? remainingRules.map((rule) => (
                      <li
                        key={rule}
                        className="relative rounded-lg border border-line bg-panel px-4 py-3 text-paper"
                      >
                        {rule}
                      </li>
                    ))
                  : null}
              </ul>
            </section>

            <section className="space-y-3 border-t border-line pt-6">
              {availabilityErrorForGame ? (
                <div className="space-y-3">
                  <p className="inline-flex items-center gap-2 text-sm font-medium text-close-ink">
                    <span aria-hidden>⚠️</span>
                    <span>Unable to load today&apos;s availability.</span>
                  </p>
                  <button
                    type="button"
                    onClick={handleRetry}
                    disabled={loading}
                    className="inline-flex items-center justify-center rounded-lg border border-line-strong bg-panel px-4 py-2 text-sm font-semibold text-paper transition hover:border-line-strong hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Retry
                  </button>
                </div>
              ) : primaryAction ? (
                primaryAction.href ? (
                  <Link
                    href={primaryAction.href}
                    className="inline-flex items-center justify-center rounded-lg border border-line-strong bg-panel px-4 py-2 text-sm font-semibold text-paper transition hover:border-line-strong hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
                    onClick={onClose}
                  >
                    {primaryAction.label}
                  </Link>
                ) : (
                  <span className="inline-flex items-center justify-center rounded-lg border border-line-strong bg-panel px-4 py-2 text-sm font-semibold text-paper">
                    {primaryAction.label}
                  </span>
                )
              ) : null}
              {!availabilityErrorForGame && !runtimeGame.playable ? (
                <p className="text-sm leading-relaxed text-muted">
                  We&apos;re polishing assets and gameplay details—thanks for
                  your patience!
                </p>
              ) : null}
              {showDemoNotice ? (
                <p className="text-sm leading-relaxed text-muted">
                  This preview is a read-only demo. Start a round to track your
                  guesses.
                </p>
              ) : null}
            </section>
          </div>

          <div className="overflow-hidden rounded-lg border border-line bg-panel">
            {media?.type === "image" ? (
              <Image
                src={media.src}
                alt={media.alt}
                width={640}
                height={400}
                className="h-full w-full object-cover"
              />
            ) : media?.type === "video" ? (
              <video
                className="h-full w-full object-cover"
                src={media.src}
                aria-label={media.alt}
                loop={media.loop ?? true}
                autoPlay={media.requiresAutoplay ?? media.autoPlay ?? false}
                muted={media.muted ?? true}
                playsInline
                preload="metadata"
              />
            ) : (
              <div
                className={`relative flex h-full min-h-[220px] flex-col items-center justify-center gap-4 bg-panel-raised p-6 text-center`}
              >
                <div className="relative z-10 space-y-3">
                  {placeholder?.icon ? (
                    <div className="text-4xl">{placeholder.icon}</div>
                  ) : null}
                  <div className="space-y-1">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-paper">
                      {placeholder?.headline ?? "Preview art coming soon"}
                    </p>
                    <p className="text-sm text-paper">
                      {placeholder?.description ??
                        "Concept visuals are in progress. Check back later!"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Dialog>
    </div>
  );

  return createPortal(modalContent, document.body);
}
