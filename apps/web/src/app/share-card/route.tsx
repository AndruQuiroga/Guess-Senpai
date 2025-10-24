import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { Buffer } from "node:buffer";

import { formatShareDate } from "../../utils/shareText";

export const runtime = "nodejs";
export const alt = "GuessSenpai daily share card";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

interface SimplifiedProgress {
  completed?: boolean;
  attempts?: number;
  round?: number;
}

interface ShareCardPayload {
  title?: string | null;
  date?: string | null;
  streak?: number | null;
  cover?: string | null;
  includeGuessTheOpening?: boolean;
  progress?: {
    anidle?: SimplifiedProgress | null;
    poster_zoomed?: SimplifiedProgress | null;
    character_silhouette?: SimplifiedProgress | null;
    redacted_synopsis?: SimplifiedProgress | null;
    guess_the_opening?: SimplifiedProgress | null;
  } | null;
}

function parsePayload(value: string | null): ShareCardPayload | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as ShareCardPayload;
    return parsed;
  } catch (error) {
    console.warn("Failed to parse share card payload", error);
    return null;
  }
}

function describeAnidle(progress: SimplifiedProgress | null | undefined): string {
  if (!progress) {
    return "Anidle — ⏳";
  }
  const attempts = Math.max(0, progress.attempts ?? 0);
  if (!progress.completed) {
    if (attempts > 0) {
      return `Anidle — ${attempts} ${attempts === 1 ? "try" : "tries"}`;
    }
    return "Anidle — In progress";
  }
  const completedAttempts = Math.max(1, attempts);
  return `Anidle — ${completedAttempts} ${
    completedAttempts === 1 ? "try" : "tries"
  } ✅`;
}

function describeRoundGame(
  label: string,
  progress: SimplifiedProgress | null | undefined,
): string {
  if (!progress) {
    return `${label} — ⏳`;
  }
  const round = Math.max(1, Math.min(3, progress.round ?? 1));
  if (progress.completed) {
    return `${label} — ✅ (${round}/3)`;
  }
  return `${label} — ${round}/3`;
}

async function loadCoverDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.warn("Failed to load share card cover", error);
    return null;
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const payload = parsePayload(searchParams.get("data"));

  if (!payload) {
    return new Response("Invalid share card payload", { status: 400 });
  }

  const formattedDate = payload.date ? formatShareDate(payload.date) : null;
  const title = payload.title?.trim() || "GuessSenpai Daily";
  const streak = payload.streak ?? 0;
  const includeOpening = Boolean(payload.includeGuessTheOpening);

  const progress = payload.progress ?? {};
  const coverSrc = await loadCoverDataUrl(payload.cover);

  const stats: string[] = [
    describeAnidle(progress.anidle),
    describeRoundGame("Poster Zoomed", progress.poster_zoomed),
    describeRoundGame("Character Silhouette", progress.character_silhouette),
    describeRoundGame("Redacted Synopsis", progress.redacted_synopsis),
  ];
  if (includeOpening) {
    stats.push(describeRoundGame("Guess the Opening", progress.guess_the_opening));
  }

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          padding: "48px",
          background:
            "radial-gradient(circle at top left, rgba(59,130,246,0.6), rgba(14,23,42,0.95))",
          color: "white",
          fontFamily: "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(15,23,42,0.65))",
            mixBlendMode: "overlay",
            pointerEvents: "none",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", zIndex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span
              style={{
                fontSize: "20px",
                letterSpacing: "0.3em",
                textTransform: "uppercase",
                opacity: 0.85,
              }}
            >
              GuessSenpai Daily
            </span>
            <h1 style={{ fontSize: "54px", fontWeight: 700, lineHeight: 1.1, maxWidth: "620px" }}>{title}</h1>
            {formattedDate ? (
              <p style={{ fontSize: "22px", color: "rgba(226,232,240,0.85)" }}>{formattedDate}</p>
            ) : null}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px 20px",
                borderRadius: "9999px",
                border: "1px solid rgba(252, 211, 77, 0.45)",
                background: "rgba(251, 191, 36, 0.22)",
                color: "#FEF3C7",
                fontSize: "22px",
                fontWeight: 600,
              }}
            >
              <span style={{ fontSize: "26px" }}>🔥</span>
              <span>Streak {Math.max(0, streak)}</span>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                padding: "20px",
                borderRadius: "24px",
                background: "rgba(15, 23, 42, 0.55)",
                border: "1px solid rgba(148, 163, 184, 0.3)",
                backdropFilter: "blur(16px)",
                minWidth: "480px",
              }}
            >
              {stats.map((line) => (
                <p key={line} style={{ fontSize: "22px", display: "flex", alignItems: "center" }}>
                  <span style={{ opacity: 0.85 }}>{line}</span>
                </p>
              ))}
            </div>
          </div>
        </div>
        <div
          style={{
            position: "relative",
            width: "360px",
            height: "100%",
            borderRadius: "36px",
            overflow: "hidden",
            border: "1px solid rgba(148, 163, 184, 0.4)",
            boxShadow: "0 25px 55px rgba(15, 23, 42, 0.45)",
            zIndex: 1,
            background: "rgba(148,163,184,0.12)",
          }}
        >
          {coverSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverSrc}
              alt="Cover art"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                fontSize: "28px",
                color: "rgba(226,232,240,0.7)",
              }}
            >
              Cover unavailable
            </div>
          )}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(15,23,42,0.05) 0%, rgba(15,23,42,0.55) 100%)",
            }}
          />
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
