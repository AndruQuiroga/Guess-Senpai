"use client";

import { useCallback, useState } from "react";

import { GlassSection } from "../GlassSection";

interface SharePanelProps {
  username?: string | null;
  streakCount: number;
  completionRate: number;
}

export function SharePanel({ username, streakCount, completionRate }: SharePanelProps) {
  const [copied, setCopied] = useState(false);
  const roundedRate = Math.round(completionRate * 100);

  const shareMessage = `I\'m on a ${streakCount}-day GuessSenpai streak with a ${roundedRate}% completion rate!`;

  const handleShare = useCallback(async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "GuessSenpai stats",
          text: shareMessage,
          url: window.location.origin,
        });
        setCopied(false);
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareMessage);
        setCopied(true);
        return;
      }
      setCopied(false);
    } catch (error) {
      console.warn("Share failed", error);
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(shareMessage);
          setCopied(true);
          return;
        } catch (clipboardError) {
          console.warn("Clipboard write failed", clipboardError);
        }
      }
      setCopied(false);
    }
  }, [shareMessage]);

  return (
    <GlassSection innerClassName="space-y-6" accent="rose" className="h-full">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wider text-rose-200/80">Share your progress</p>
        <h2 className="text-lg font-semibold text-white">Spread the word</h2>
      </header>
      <p className="text-sm leading-relaxed text-neutral-200">
        {username ? `${username},` : "You"} have a {streakCount}-day streak and a {roundedRate}% completion rate. Let your
        friends know and challenge them to beat it!
      </p>
      <button
        type="button"
        onClick={handleShare}
        className="inline-flex items-center justify-center rounded-full border border-rose-300/60 bg-rose-500/20 px-5 py-2 text-sm font-semibold text-rose-50 transition hover:border-rose-200 hover:bg-rose-400/30"
      >
        Share stats
      </button>
      {copied && <p className="text-xs text-rose-200/80">Copied to clipboard — paste anywhere to brag.</p>}
    </GlassSection>
  );
}
