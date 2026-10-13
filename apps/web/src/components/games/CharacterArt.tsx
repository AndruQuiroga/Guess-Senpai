"use client";

import { useEffect, useMemo, useRef } from "react";

/**
 * How a character card hides its art. Easy and Medium rounds use the ink
 * shadow; Hard rounds rotate through the other three so each Hard lineup asks
 * for a different kind of recognition. Every mode has three levels (0-2); each
 * Sharpen hint moves one level clearer.
 */
export type ArtMode = "shadow" | "crop" | "mosaic" | "tiles";

export const ART_LEVELS = 3;

const SHADOW_FILTERS = [
  "grayscale(1) contrast(8) brightness(0.22) blur(4px)",
  "grayscale(1) contrast(2.6) brightness(0.6) blur(1.5px)",
  "grayscale(0.5) blur(0.5px)",
] as const;
/** Close-up zoom per level: roughly a seventh, a quarter, then half the art. */
const CROP_SCALES = [2.6, 1.9, 1.4] as const;
/** Mosaic blocks across the card per level. */
const MOSAIC_BLOCKS = [7, 12, 20] as const;
/** Tiles put back in place per level (of 9). */
const TILES_FIXED = [0, 3, 6] as const;

const HARD_ROTATION: ArtMode[] = ["crop", "mosaic", "tiles"];

export function artModeFor(difficulty: number, card: number): ArtMode {
  return difficulty >= 3
    ? HARD_ROTATION[card % HARD_ROTATION.length]
    : "shadow";
}

export const ART_MODE_LABELS: Record<ArtMode, string> = {
  shadow: "Shadow",
  crop: "Close-up",
  mosaic: "Mosaic",
  tiles: "Scrambled",
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

/** A derangement-ish shuffle of 9 tiles with `fixed` of them in place. */
function tileOrder(seed: number, fixed: number): number[] {
  const random = seeded(seed + 7);
  const order = Array.from({ length: 9 }, (_, index) => index);
  for (let index = order.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [order[index], order[swap]] = [order[swap], order[index]];
  }
  // Make sure nothing starts in place, so level 0 is fully scrambled.
  for (let index = 0; index < order.length; index += 1) {
    if (order[index] === index) {
      const other = (index + 1) % order.length;
      [order[index], order[other]] = [order[other], order[index]];
    }
  }
  // Restore tiles in a fixed, seeded sequence as the level rises.
  const restoreOrder = Array.from({ length: 9 }, (_, index) => index).sort(
    () => random() - 0.5,
  );
  for (const position of restoreOrder.slice(0, fixed)) {
    const current = order.indexOf(position);
    [order[position], order[current]] = [order[current], order[position]];
  }
  return order;
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
      data-art="mosaic"
      className="aspect-[3/4] w-full"
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
  const order = useMemo(
    () => (mode === "tiles" ? tileOrder(seed, TILES_FIXED[step]) : []),
    [mode, seed, step],
  );

  return (
    <div
      role="img"
      aria-label={label}
      data-art={mode}
      data-level={step}
      className="relative aspect-[3/4] w-full overflow-hidden bg-ink"
    >
      {mode === "shadow" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          draggable={false}
          className="h-full w-full object-cover"
          style={{ filter: SHADOW_FILTERS[step] }}
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
      {mode === "tiles" ? (
        <div className="grid h-full w-full grid-cols-3 grid-rows-3 gap-px bg-ink">
          {order.map((tile, position) => (
            <div
              key={position}
              data-tile={tile}
              data-in-place={tile === position ? "true" : undefined}
              style={{
                backgroundImage: `url("${src}")`,
                backgroundSize: "300% 300%",
                backgroundPosition: `${(tile % 3) * 50}% ${Math.floor(tile / 3) * 50}%`,
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
