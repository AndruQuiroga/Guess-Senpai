"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { OpeningClip } from "../../types/puzzles";

const DEFAULT_WINDOW = { start: 20, end: 50 };
/**
 * Seconds kept off-limits at each end of the song: openings usually show
 * the title card early and the credits late.
 */
const EDGE_SECONDS = 20;
/** The video clue is a hazy impression, not a free answer. */
const VIDEO_CLUE_FILTER = "blur(14px) saturate(0.45)";

function formatSeconds(value: number) {
  const safe = Math.max(0, Math.floor(value));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

/**
 * The playable window: the server's window, kept past the opening's first
 * 20 seconds and, once the real length is known, pulled back before its
 * last 20 (AnimeThemes doesn't report lengths, so the server assumes 90s).
 */
export function clipWindow(clip: OpeningClip, duration?: number | null) {
  const rawStart = clip.startSeconds ?? DEFAULT_WINDOW.start;
  const rawEnd = Math.max(rawStart + 1, clip.endSeconds ?? DEFAULT_WINDOW.end);
  const length = rawEnd - rawStart;
  let start = Math.max(rawStart, EDGE_SECONDS);
  let end = start + length;
  if (duration && Number.isFinite(duration) && duration > 0) {
    const margin = Math.min(EDGE_SECONDS, duration * 0.2);
    const latestEnd = duration - margin;
    if (end > latestEnd) {
      end = latestEnd;
      start = Math.max(margin, end - length);
    }
    if (end - start < 1) return { start: 0, end: duration };
  }
  return { start, end };
}

/**
 * Opening player limited to the clip's window. There are no native controls,
 * so the rest of the song (and the credits that name the show) can't be
 * scrubbed to. Until `showVideo` it plays the light audio file (falling back
 * to the video's soundtrack); the video clue itself is blurred. `unrestricted`
 * lifts the window and the blur for the results screen.
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
  const isVideo = Boolean(showVideo && clip.videoUrl);
  const sources = (
    isVideo ? [clip.videoUrl] : [clip.audioUrl, clip.videoUrl]
  ).filter((value, index, all): value is string =>
    Boolean(value && all.indexOf(value) === index),
  );
  const sourceKey = sources.join("|");
  const mediaRef = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  // Carry the listener's place (and whether it was playing) across the
  // audio → video switch, which swaps the media element.
  const resumeAt = useRef<number | null>(null);
  const resumePlaying = useRef(false);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);
  const { start, end } = clipWindow(clip, duration);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [position, setPosition] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [failed, setFailed] = useState(false);
  const source = sources[sourceIndex] ?? null;

  useEffect(() => {
    setSourceIndex(0);
    setFailed(false);
    setPlaying(false);
    setBuffering(false);
  }, [sourceKey]);

  useEffect(() => {
    const media = mediaRef.current;
    if (media) media.volume = volume;
  }, [volume, source]);

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
    if (failed) {
      // Retry from scratch: a stalled or errored source needs a fresh load.
      setSourceIndex(0);
      media.load();
    }
    clamp();
    try {
      setFailed(false);
      await media.play();
    } catch (error) {
      // An aborted play (the source changed underneath it) is not a failure.
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setFailed(true);
      }
    }
  }, [clamp, failed]);

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
      if (!media) return;
      const known = Number.isFinite(media.duration) ? media.duration : null;
      setDuration(known);
      if (unrestricted) return;
      const fitted = clipWindow(clip, known);
      const resume = resumeAt.current;
      media.currentTime =
        resume !== null && resume >= fitted.start && resume < fitted.end
          ? resume
          : fitted.start;
      resumeAt.current = null;
      if (resumePlaying.current) {
        resumePlaying.current = false;
        media.play().catch(() => undefined);
      }
    },
    onTimeUpdate: () => {
      const media = mediaRef.current;
      if (!media) return;
      clamp();
      if (!media.paused) {
        resumeAt.current = media.currentTime;
        resumePlaying.current = true;
      }
      setPosition(Math.max(0, media.currentTime - (unrestricted ? 0 : start)));
    },
    onPlay: () => {
      setPlaying(true);
      setFailed(false);
    },
    onPause: () => {
      setPlaying(false);
      resumePlaying.current = false;
    },
    onWaiting: () => setBuffering(true),
    onPlaying: () => setBuffering(false),
    onCanPlay: () => setBuffering(false),
    onError: () => {
      // e.g. Safari can't decode the .ogg: fall back to the video's audio.
      if (sourceIndex + 1 < sources.length) {
        setSourceIndex(sourceIndex + 1);
        return;
      }
      setPlaying(false);
      setBuffering(false);
      setFailed(true);
    },
  };

  if (unrestricted && clip.videoUrl && isVideo) {
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
        <div className="relative aspect-video w-full overflow-hidden rounded-md border border-line bg-ink">
          <video
            {...shared}
            playsInline
            aria-label={label}
            // Scaled up so the blur doesn't leave soft, see-through edges.
            className="h-full w-full scale-110 object-cover"
            style={{ filter: VIDEO_CLUE_FILTER }}
          />
        </div>
      ) : (
        <>
          <audio {...shared} aria-label={label} />
          <div
            aria-hidden
            className="flex aspect-[16/5] w-full items-center justify-center rounded-md border border-dashed border-line-strong bg-ink text-sm text-muted"
          >
            ♪ Audio only
          </div>
        </>
      )}
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
            {playing && buffering ? "Loading… " : ""}
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
          The clip couldn&apos;t play. Press Play to try again, or check your
          sound.
        </p>
      ) : null}
    </div>
  );
}
