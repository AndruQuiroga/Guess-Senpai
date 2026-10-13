"use client";

import { useEffect, useMemo, useRef } from "react";

/**
 * How a character card hides its art. Every round uses popular characters;
 * the round decides the view: Easy is black and white, Medium a full-colour
 * close-up of one detail, Hard a full-colour mosaic. Each mode has three
 * levels (0-2) and each bought "Sharpen" moves a card one level clearer.
 */
export type ArtMode = "mono" | "crop" | "mosaic";

export const ART_LEVELS = 3;

const MONO_FILTERS = [
  "grayscale(1) contrast(1.15) blur(3px)",
  "grayscale(1) blur(1.2px)",
  "grayscale(1)",
] as const;
/** Close-up zoom per level: roughly a seventh, a quarter, then half the art. */
const CROP_SCALES = [2.6, 1.9, 1.4] as const;
/** Mosaic blocks across the card per level. */
const MOSAIC_BLOCKS = [8, 13, 22] as const;

const MODE_BY_DIFFICULTY: Record<number, ArtMode> = {
  1: "mono",
  2: "crop",
  3: "mosaic",
};

export function artModeFor(difficulty: number): ArtMode {
  return MODE_BY_DIFFICULTY[difficulty] ?? "mono";
}

export const ART_MODE_LABELS: Record<ArtMode, string> = {
  mono: "Black and white",
  crop: "Close-up",
  mosaic: "Mosaic",
};

/** Small deterministic PRNG so a card looks the same after a reload. */
function seeded(seed: number) {
  let state = (seed * 2654435761) >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 10_000) / 10_000;
  };
}

function Mosaic({ src, blocks }: { src: string; blocks: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const image = new Image();
    // Drawing never reads pixels back, so a cross-origin image is fine.
    image.onload = () => {
      const width = blocks;
      const height = Math.round((blocks * 4) / 3);
      const small = document.createElement("canvas");
      small.width = width;
      small.height = height;
      const smallContext = small.getContext("2d");
      if (!smallContext) return;
      // object-fit: cover into the 3:4 card.
      const ratio = Math.max(width / image.width, height / image.height);
      const drawWidth = image.width * ratio;
      const drawHeight = image.height * ratio;
      smallContext.drawImage(
        image,
        (width - drawWidth) / 2,
        (height - drawHeight) / 2,
        drawWidth,
        drawHeight,
      );
      context.imageSmoothingEnabled = false;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(small, 0, 0, canvas.width, canvas.height);
    };
    image.src = src;
  }, [blocks, src]);
  return (
    <canvas
      ref={canvasRef}
      width={300}
      height={400}
      className="h-full w-full"
    />
  );
}

export function CharacterArt({
  src,
  mode,
  level,
  seed,
  label,
}: {
  src: string;
  mode: ArtMode;
  level: number;
  seed: number;
  label: string;
}) {
  const step = Math.max(0, Math.min(ART_LEVELS - 1, level));
  const origin = useMemo(() => {
    const random = seeded(seed);
    // AniList portraits put the face in the upper third: stay on the head
    // so a close-up shows hair, eyes or an accessory, not a blank torso.
    return { x: 30 + random() * 40, y: 8 + random() * 27 };
  }, [seed]);

  return (
    <div
      role="img"
      aria-label={label}
      data-art={mode}
      data-level={step}
      className="relative aspect-[3/4] w-full overflow-hidden bg-ink"
    >
      {mode === "mono" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          draggable={false}
          className="h-full w-full object-cover"
          style={{ filter: MONO_FILTERS[step] }}
        />
      ) : null}
      {mode === "crop" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          draggable={false}
          className="h-full w-full object-cover transition-transform duration-500"
          style={{
            transform: `scale(${CROP_SCALES[step]})`,
            transformOrigin: `${origin.x}% ${origin.y}%`,
          }}
        />
      ) : null}
      {mode === "mosaic" ? (
        <Mosaic src={src} blocks={MOSAIC_BLOCKS[step]} />
      ) : null}
    </div>
  );
}
