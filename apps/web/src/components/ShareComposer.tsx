"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  DEFAULT_SHARE_THEME,
  SHARE_CARD_THEMES,
  ShareCardTheme,
} from "../utils/shareThemes";
import { ShareEventData, formatShareEventMessage } from "../utils/shareText";

export interface ShareCardRequestPayload {
  event: ShareEventData;
  title?: string | null;
  streak?: number | null;
  cover?: string | null;
}

interface ShareComposerProps {
  payload: ShareCardRequestPayload;
  shareMessage?: string;
  shareLocked?: boolean;
  fileName: string;
}

export function ShareComposer({
  payload,
  shareMessage,
  shareLocked = false,
  fileName,
}: ShareComposerProps) {
  const [selectedTheme, setSelectedTheme] = useState<ShareCardTheme>(
    DEFAULT_SHARE_THEME.id,
  );
  const [supportsFileShare, setSupportsFileShare] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const resolvedMessage = useMemo(() => {
    if (shareMessage?.trim()) {
      return shareMessage.trim();
    }
    return formatShareEventMessage(payload.event);
  }, [payload.event, shareMessage]);

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

  useEffect(() => {
    if (!status) return;
    const timeout = window.setTimeout(() => setStatus(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [status]);

  const handleThemeSelect = useCallback((theme: ShareCardTheme) => {
    setSelectedTheme(theme);
  }, []);

  const handleShareCard = useCallback(async () => {
    if (shareLocked || isProcessing) {
      return;
    }
    try {
      setIsProcessing(true);
      setStatus("Preparing share card…");

      const params = new URLSearchParams({
        data: JSON.stringify({
          ...payload,
          theme: selectedTheme,
        }),
      });

      const response = await fetch(`/api/share-card?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Failed to generate share card: ${response.status}`);
      }

      const blob = await response.blob();
      const cardFileName = `${fileName}-${selectedTheme}.png`;

      if (supportsFileShare && navigator.share) {
        const file = new File([blob], cardFileName, {
          type: blob.type || "image/png",
        });
        const shareData: ShareData = {
          files: [file],
          text: resolvedMessage,
        };
        if (!navigator.canShare || navigator.canShare(shareData)) {
          await navigator.share(shareData);
          setStatus("Shared");
          return;
        }
      }

      if (navigator.share) {
        await navigator.share({ text: resolvedMessage });
        setStatus("Shared summary");
        return;
      }

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = cardFileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      setStatus("Card downloaded");
    } catch (error) {
      console.warn("Share cancelled", error);
      setStatus("Unable to share card");
    } finally {
      setIsProcessing(false);
    }
  }, [
    fileName,
    isProcessing,
    payload,
    resolvedMessage,
    selectedTheme,
    shareLocked,
    supportsFileShare,
  ]);

  const handleShareSummary = useCallback(async () => {
    try {
      if (navigator.share) {
        await navigator.share({ text: resolvedMessage });
        setStatus("Shared summary");
        return;
      }
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(resolvedMessage);
        setStatus("Copied summary");
        return;
      }
    } catch (error) {
      console.warn("Share summary cancelled", error);
      setStatus("Unable to share summary");
      return;
    }
    setStatus("Sharing unavailable on this device");
  }, [resolvedMessage]);

  const shareIntentUrl = useMemo(() => {
    const encoded = encodeURIComponent(resolvedMessage);
    return `https://twitter.com/intent/tweet?text=${encoded}`;
  }, [resolvedMessage]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-medium text-[#c1c2bd]">
          Customize your card
        </p>
        <div className="flex flex-wrap gap-3">
          {SHARE_CARD_THEMES.map((theme) => {
            const active = selectedTheme === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => handleThemeSelect(theme.id)}
                className={`group relative overflow-hidden rounded-lg border px-4 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80 ${active ? "border-[#686b6d]" : "border-[#686b6d]"}`}
                style={{
                  background: theme.previewGradient,
                  color: theme.textColor,
                }}
                aria-pressed={active}
              >
                <div className="relative z-10 space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#f4f0e7]">
                    Theme
                  </span>
                  <p className="text-sm font-medium text-[#f4f0e7]">
                    {theme.label}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleShareCard}
          disabled={shareLocked || isProcessing}
          className="inline-flex items-center justify-center rounded-lg border border-[#ff7658] bg-[#ff7658] hover:bg-[#ff8a70] px-5 py-2 text-sm font-semibold text-[#27110b] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {shareLocked
            ? "Play a round to unlock"
            : isProcessing
              ? "Preparing…"
              : "Share card"}
        </button>
        <button
          type="button"
          onClick={handleShareSummary}
          className="inline-flex items-center justify-center rounded-lg border border-[#686b6d] bg-[#2c2f31] px-5 py-2 text-sm font-semibold text-[#f4f0e7] transition hover:border-[#ff7658] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
        >
          Share summary
        </button>
        <a
          href={shareIntentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-lg border border-[#4b87a6] bg-[#22343f] px-5 py-2 text-sm font-semibold text-sky-100 transition hover:border-[#4b87a6] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200/80"
        >
          Post to X
        </a>
      </div>
      {status ? (
        <p className="inline-flex items-center gap-2 rounded-full border border-[#686b6d] bg-[#2c2f31] px-4 py-1.5 text-xs text-[#f4f0e7] transition">
          {status}
        </p>
      ) : null}
    </div>
  );
}
