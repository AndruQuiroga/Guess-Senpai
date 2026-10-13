"use client";

import { useCallback } from "react";

import { useNotificationOptIn } from "../hooks/useNotificationOptIn";
import { PanelSection } from "./PanelSection";

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
    ? "Push notifications are enabled. Scheduled daily delivery is not currently active."
    : permissionDenied
      ? "Notifications are blocked in your browser. Update site permissions to re-enable alerts."
      : "Enable web push notifications. Scheduled daily delivery is not currently active.";

  const buttonLabel = isSubscribed
    ? "Disable notifications"
    : "Enable notifications";

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
    <PanelSection innerClassName="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-200">
          Notifications
        </p>
        <h2 className="text-lg font-display font-semibold tracking-tight text-[#f4f0e7]">
          Notification settings
        </h2>
        <p className="text-sm text-[#c1c2bd]">{description}</p>
        {error && <p className="text-xs text-rose-200">{error}</p>}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleClick}
          disabled={isLoading || permissionDenied}
          className="inline-flex items-center justify-center rounded-lg border border-[#686b6d] bg-[#2c2f31] px-5 py-2 text-sm font-semibold text-[#f4f0e7] transition hover:bg-[#2c2f31] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Saving…" : buttonLabel}
        </button>
        {permissionDenied && (
          <span className="text-xs text-amber-200">
            Allow notifications for guesssenpai.com in your browser to turn this
            on.
          </span>
        )}
      </div>
    </PanelSection>
  );
}
