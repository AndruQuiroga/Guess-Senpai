"use client";

import { useCallback } from "react";

import { useNotificationOptIn } from "../hooks/useNotificationOptIn";
import { GlassSection } from "./GlassSection";

export default function NotificationOptInCard(): JSX.Element | null {
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    requestOptIn,
    cancelOptIn,
  } = useNotificationOptIn();

  const permissionDenied = permission === "denied";

  const description = isSubscribed
    ? "We’ll send a gentle ping when tomorrow’s challenge is ready."
    : permissionDenied
      ? "Notifications are blocked in your browser. Update site permissions to re-enable alerts."
      : "Enable web push to be the first to know when new GuessSenpai puzzles drop.";

  const buttonLabel = isSubscribed ? "Disable notifications" : "Notify me about new puzzles";

  const handleClick = useCallback(async () => {
    if (isSubscribed) {
      await cancelOptIn();
      return;
    }
    await requestOptIn();
  }, [cancelOptIn, isSubscribed, requestOptIn]);

  if (!isSupported) {
    return null;
  }

  return (
    <GlassSection accent="brand" innerClassName="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-200/80">
          Daily reminders
        </p>
        <h2 className="text-lg font-display font-semibold tracking-tight text-white">
          Stay in the loop
        </h2>
        <p className="text-sm text-neutral-300/90">{description}</p>
        {error && (
          <p className="text-xs text-rose-200/80">{error}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleClick}
          disabled={isLoading || permissionDenied}
          className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Saving…" : buttonLabel}
        </button>
        {permissionDenied && (
          <span className="text-xs text-amber-200/80">
            Allow notifications for guesssenpai.com in your browser to turn this on.
          </span>
        )}
      </div>
    </GlassSection>
  );
}
