"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { GameDirectoryEntry, resolveGameAvailability } from "../config/games";
import { useDailyAvailability } from "../hooks/useDailyAvailability";
import { GameProgress } from "../types/progress";

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

export function GamePreviewModal({ open, game, onClose, progress }: GamePreviewModalProps) {
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const { guessTheOpeningEnabled, error, refresh, loading } = useDailyAvailability();
  const showAvailabilityError = error;
  const handleRetry = useCallback(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS);
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
    return () => document.removeEventListener("keydown", handleKeyDown);
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

  const primaryAction = useMemo<PrimaryAction | null>(() => {
    if (!runtimeGame || showAvailabilityError) return null;
    if (!runtimeGame.playable) {
      return {
        label: "Coming soon",
        href: null,
        disabled: true,
      };
    }

    const href = `/games/${runtimeGame.slug}`;
    if (progress?.completed) {
      return { label: "View completed round", href, disabled: false };
    }
    if (progress) {
      return { label: "Resume game", href, disabled: false };
    }
    return { label: "Start playing", href, disabled: false };
  }, [progress, runtimeGame, showAvailabilityError]);
  const showDemoNotice = runtimeGame?.playable && !progress && !showAvailabilityError;

  if (!mounted || !open || !runtimeGame) {
    return null;
  }

  const titleId = `game-preview-title-${runtimeGame.slug}`;
  const descriptionId = `game-preview-description-${runtimeGame.slug}`;
  const media = runtimeGame.preview.media;
  const placeholder = runtimeGame.preview.placeholder;

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 sm:px-6">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleBackdropClick}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative z-10 w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-surface-raised/95 text-white shadow-ambient"
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/80 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
          aria-label="Close preview"
        >
          <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 011.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        <div className="grid gap-6 p-6 sm:grid-cols-[1.1fr_0.9fr] sm:gap-8 sm:p-8">
          <div className="space-y-4">
            <span className="inline-flex w-fit items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-neutral-200/80">
              {runtimeGame.playable
                ? "Featured game"
                : runtimeGame.comingSoon
                  ? "In development"
                  : "Unavailable"}
            </span>
            <div className="space-y-2">
              <h2 id={titleId} className="text-2xl font-display font-semibold tracking-tight sm:text-3xl">
                {runtimeGame.title}
              </h2>
              <p className="text-sm uppercase tracking-[0.3em] text-neutral-400">{runtimeGame.tagline}</p>
            </div>
            <p id={descriptionId} className="text-base leading-relaxed text-neutral-200">
              {runtimeGame.preview.summary}
            </p>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-300">
                How to play
              </h3>
              <ul className="space-y-2 text-sm leading-relaxed text-neutral-200">
                {runtimeGame.preview.rules.map((rule, index) => (
                  <li key={rule} className="flex gap-2">
                    <span className="mt-1 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 text-[0.7rem] font-semibold text-white/80">
                      {index + 1}
                    </span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {showAvailabilityError ? (
                <>
                  <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/15 px-4 py-2 text-sm font-medium text-amber-50">
                    ⚠️ Unable to load today&apos;s availability
                  </span>
                  <button
                    type="button"
                    onClick={handleRetry}
                    disabled={loading}
                    className="inline-flex items-center justify-center rounded-2xl border border-amber-300/60 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:border-amber-200/70 hover:text-amber-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200/70"
                  >
                    Retry
                  </button>
                </>
              ) : primaryAction ? (
                primaryAction.href ? (
                  <Link
                    href={primaryAction.href}
                    className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-brand-500 via-purple-500 to-pink-500 px-5 py-2 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.01] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
                    onClick={onClose}
                  >
                    {primaryAction.label}
                  </Link>
                ) : (
                  <span className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-5 py-2 text-sm font-semibold text-white/80">
                    {primaryAction.label}
                  </span>
                )
              ) : null}
              {!showAvailabilityError && !runtimeGame.playable ? (
                <span className="text-sm text-neutral-300">
                  We&apos;re polishing assets and gameplay details—thanks for your patience!
                </span>
              ) : null}
              {showDemoNotice ? (
                <span className="text-sm text-neutral-300">
                  This preview is a read-only demo. Start a round to track your guesses.
                </span>
              ) : null}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
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
                className={`relative flex h-full min-h-[220px] flex-col items-center justify-center gap-4 bg-gradient-to-br ${runtimeGame.accentColor} p-6 text-center`}
              >
                <div className="absolute inset-0 bg-black/10" aria-hidden />
                <div className="relative z-10 space-y-3">
                  {placeholder?.icon ? (
                    <div className="text-4xl">{placeholder.icon}</div>
                  ) : null}
                  <div className="space-y-1">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">
                      {placeholder?.headline ?? "Preview art coming soon"}
                    </p>
                    <p className="text-sm text-white/80">
                      {placeholder?.description ?? "Concept visuals are in progress. Check back later!"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
