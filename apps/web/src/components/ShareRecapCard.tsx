"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { ShareCardRequestPayload } from "./ShareComposer";

import { DEFAULT_SHARE_THEME } from "../utils/shareThemes";
import type { ShareEventData } from "../utils/shareText";
import { showToast } from "../utils/toast";

interface ShareRecapCardProps {
  event: ShareEventData;
  shareMessage: string;
  fileName: string;
  streakCount: number;
}

export function ShareRecapCard({
  event,
  shareMessage,
  fileName,
  streakCount,
}: ShareRecapCardProps): JSX.Element {
  const [supportsFileShare, setSupportsFileShare] = useState(false);
  const [isProcessingCard, setIsProcessingCard] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined") {
      setSupportsFileShare(false);
      return;
    }
    if (!navigator.share || typeof navigator.canShare !== "function") {
      setSupportsFileShare(false);
      return;
    }
    try {
      const testFile = new File([""], "test.txt", { type: "text/plain" });
      setSupportsFileShare(navigator.canShare({ files: [testFile] }));
    } catch {
      setSupportsFileShare(false);
    }
  }, []);

  const shareCardPayload = useMemo<ShareCardRequestPayload>(
    () => ({
      event,
      streak: streakCount,
    }),
    [event, streakCount],
  );

  const handleShareSummary = useCallback(async () => {
    try {
      if (navigator.share) {
        await navigator.share({ text: shareMessage });
        showToast("Progress shared", "success");
        return;
      }
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareMessage);
        showToast("Copied recap to clipboard", "success");
        return;
      }
    } catch (error) {
      console.warn("Share summary cancelled", error);
      showToast("Sharing cancelled", "error");
      return;
    }
    showToast("Unable to share on this device", "error");
  }, [shareMessage]);

  const handleDownloadCard = useCallback(async () => {
    if (isProcessingCard) {
      return;
    }

    try {
      setIsProcessingCard(true);
      const params = new URLSearchParams({
        data: JSON.stringify({
          ...shareCardPayload,
          theme: DEFAULT_SHARE_THEME.id,
        }),
      });

      const response = await fetch(`/api/share-card?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Failed to generate share card: ${response.status}`);
      }

      const blob = await response.blob();
      const cardFileName = `${fileName}-${DEFAULT_SHARE_THEME.id}.png`;

      if (supportsFileShare && navigator.share) {
        const file = new File([blob], cardFileName, {
          type: blob.type || "image/png",
        });
        const shareData: ShareData = {
          files: [file],
          text: shareMessage,
        };
        if (!navigator.canShare || navigator.canShare(shareData)) {
          await navigator.share(shareData);
          showToast("Recap shared", "success");
          return;
        }
      }

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = cardFileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      showToast("Recap card downloaded", "success");
    } catch (error) {
      console.warn("Unable to export share card", error);
      showToast("Unable to prepare recap card", "error");
    } finally {
      setIsProcessingCard(false);
    }
  }, [
    fileName,
    isProcessingCard,
    shareCardPayload,
    shareMessage,
    supportsFileShare,
  ]);

  return (
    <section className="relative overflow-hidden rounded-lg border border-[#484b4d] bg-surface-raised p-6 text-white sm:p-8">
      <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3 sm:max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#686b6d] bg-[#2c2f31] px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-[#f4f0e7]">
            Daily recap ready
          </span>
          <div className="space-y-2">
            <h2 className="text-2xl font-display font-semibold tracking-tight">
              Share your {event.formattedDate} streak
            </h2>
            <p className="text-sm text-[#c1c2bd] sm:text-base">
              You cleared every round today. Download the recap card or share
              the summary in a single tap.
            </p>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#c1c2bd]">
              Current streak · {streakCount}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:w-64">
          <button
            type="button"
            onClick={handleDownloadCard}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#ff7658] bg-[#ff7658] hover:bg-[#ff8a70] px-5 py-2.5 text-sm font-semibold text-[#27110b] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isProcessingCard}
          >
            {isProcessingCard ? "Preparing recap…" : "Download recap card"}
          </button>
          <button
            type="button"
            onClick={handleShareSummary}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#686b6d] bg-[#2c2f31] px-5 py-2.5 text-sm font-semibold text-[#f4f0e7] transition hover:border-[#ff7658] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
          >
            Share summary
          </button>
        </div>
      </div>
    </section>
  );
}
