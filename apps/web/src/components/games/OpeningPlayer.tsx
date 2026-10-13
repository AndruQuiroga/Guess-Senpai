"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { OpeningClip } from "../../types/puzzles";

const DEFAULT_WINDOW = { start: 10, end: 40 };

function formatSeconds(value: number) {
  const safe = Math.max(0, Math.floor(value));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

export function clipWindow(clip: OpeningClip) {
  const start = clip.startSeconds ?? DEFAULT_WINDOW.start;
  const end = Math.max(start + 1, clip.endSeconds ?? DEFAULT_WINDOW.end);
  return { start, end };
}

/**
 * Opening player limited to the clip's window. There are no native controls,
 * so the rest of the song (and the credits that name the show) can't be
 * scrubbed to. The video stays hidden until `showVideo`; `unrestricted` lifts
 * the window for the results screen.
 */
export function OpeningPlayer({
  clip,
  showVideo,
  unrestricted = false,
  label,
}: {
  clip: OpeningClip;
  showVideo: boolean;
  unrestricted?: boolean;
  label: string;
}) {
  const source = clip.videoUrl ?? clip.audioUrl ?? null;
  const isVideo = Boolean(clip.videoUrl);
  const mediaRef = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const { start, end } = clipWindow(clip);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const media = mediaRef.current;
    if (media) media.volume = volume;
  }, [volume]);

  const clamp = useCallback(() => {
    const media = mediaRef.current;
    if (!media || unrestricted) return;
    if (media.currentTime < start - 0.25 || media.currentTime >= end) {
      if (media.currentTime >= end) {
        media.pause();
      }
      media.currentTime = start;
    }
  }, [end, start, unrestricted]);

  const toggle = useCallback(async () => {
    const media = mediaRef.current;
    if (!media) return;
    if (!media.paused) {
      media.pause();
      return;
    }
    clamp();
    try {
      await media.play();
    } catch {
      setFailed(true);
    }
  }, [clamp]);

  const restart = useCallback(() => {
    const media = mediaRef.current;
    if (!media) return;
    media.currentTime = unrestricted ? 0 : start;
    setPosition(0);
  }, [start, unrestricted]);

  if (!source) {
    return (
      <p className="rounded-lg border border-line bg-panel p-4 text-sm text-muted">
        No clip is available for this opening.
      </p>
    );
  }

  const length = unrestricted ? null : end - start;
  const shared = {
    ref: mediaRef,
    src: source,
    preload: "metadata" as const,
    onLoadedMetadata: () => {
      const media = mediaRef.current;
      if (media && !unrestricted) media.currentTime = start;
    },
    onTimeUpdate: () => {
      const media = mediaRef.current;
      if (!media) return;
      clamp();
      setPosition(Math.max(0, media.currentTime - (unrestricted ? 0 : start)));
    },
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false),
    onError: () => setFailed(true),
  };

  if (unrestricted && isVideo) {
    return (
      <video
        {...shared}
        controls
        playsInline
        className="aspect-video w-full rounded-lg border border-line-strong bg-ink"
        aria-label={label}
      />
    );
  }

  return (
    <div className="relative space-y-3 rounded-lg border border-line-strong bg-panel p-4">
      {isVideo ? (
        <video
          {...shared}
          playsInline
          aria-label={label}
          className={
            showVideo
              ? "aspect-video w-full rounded-md border border-line bg-ink"
              : // Audio only: the element keeps playing sound while hidden.
                "pointer-events-none absolute h-px w-px opacity-0"
          }
        />
      ) : (
        <audio {...shared} aria-label={label} />
      )}
      {isVideo && !showVideo ? (
        <div
          aria-hidden
          className="flex aspect-[16/5] w-full items-center justify-center rounded-md border border-dashed border-line-strong bg-ink text-sm text-muted"
        >
          ♪ Audio only
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void toggle()}
          className="button button-primary min-w-28"
          aria-label={playing ? "Pause clip" : "Play clip"}
        >
          {playing ? "❚❚ Pause" : "▶ Play"}
        </button>
        <button
          type="button"
          onClick={restart}
          className="min-h-11 rounded-md border border-line-strong px-3 text-sm font-semibold text-paper hover:bg-hover"
        >
          ↺ Restart
        </button>
        <div className="flex min-w-[10rem] flex-1 items-center gap-2">
          <div
            className="h-2 flex-1 overflow-hidden rounded-full bg-ink"
            role="progressbar"
            aria-label="Clip progress"
            aria-valuemin={0}
            aria-valuemax={length ?? 100}
            aria-valuenow={Math.round(position)}
          >
            <div
              className="h-full bg-signal"
              style={{
                width: length
                  ? `${Math.min(100, (position / length) * 100)}%`
                  : "0%",
              }}
            />
          </div>
          <span className="text-xs tabular-nums text-muted">
            {formatSeconds(position)}
            {length ? ` / ${formatSeconds(length)}` : ""}
          </span>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted">
          Volume
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
            className="w-24 accent-[var(--signal)]"
          />
        </label>
      </div>
      {failed ? (
        <p role="alert" className="text-sm text-danger-ink">
          The clip couldn&apos;t play. Try Play again or check your sound.
        </p>
      ) : null}
    </div>
  );
}
