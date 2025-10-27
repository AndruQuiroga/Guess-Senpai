import { promises as fs } from "node:fs";
import { Buffer } from "node:buffer";

import { Resvg } from "@resvg/resvg-js";
import satori from "satori";
import type { NextRequest } from "next/server";

import {
  type ShareEventData,
  type ShareEventGame,
  type ShareRoundState,
} from "../../utils/shareText";
import {
  ShareCardTheme,
  getShareThemeConfig,
} from "../../utils/shareThemes";

export const runtime = "nodejs";
export const alt = "GuessSenpai daily share card";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

const FONT_REGULAR_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
const FONT_BOLD_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";

interface ShareCardRequestPayload {
  event?: ShareEventData | null;
  title?: string | null;
  streak?: number | null;
  cover?: string | null;
  theme?: ShareCardTheme | string | null;
}

const fontCache = new Map<string, Promise<ArrayBuffer>>();

function loadFont(path: string): Promise<ArrayBuffer> {
  const existing = fontCache.get(path);
  if (existing) {
    return existing;
  }
  const promise = fs.readFile(path).then((buffer) =>
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  );
  fontCache.set(path, promise);
  return promise;
}

function parsePayload(value: string | null): ShareCardRequestPayload | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as ShareCardRequestPayload;
    return parsed;
  } catch (error) {
    console.warn("Failed to parse share card payload", error);
    return null;
  }
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

function roundStateColor(state: ShareRoundState, accent: string): string {
  switch (state) {
    case "cleared":
      return accent;
    case "active":
      return "rgba(248,250,252,0.85)";
    default:
      return "rgba(148,163,184,0.35)";
  }
}

function roundStateOpacity(state: ShareRoundState): number {
  return state === "locked" ? 0.5 : 1;
}

function renderGameRow(game: ShareEventGame, accent: string) {
  const detail = game.summary.replace(`${game.label} — `, "");
  return (
    <div
      key={game.key}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        padding: "16px",
        borderRadius: "20px",
        background: "rgba(15,23,42,0.55)",
        border: "1px solid rgba(148,163,184,0.25)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <span style={{ fontSize: "26px", fontWeight: 600 }}>{game.label}</span>
        <span style={{ fontSize: "20px", opacity: 0.85 }}>{detail}</span>
      </div>
      {game.rounds.length > 0 ? (
        <div style={{ display: "flex", gap: "10px" }}>
          {game.rounds.map((round) => (
            <div
              key={`${game.key}-${round.round}`}
              style={{
                width: "18px",
                height: "18px",
                borderRadius: "9999px",
                background: roundStateColor(round.state, accent),
                border: "1px solid rgba(248,250,252,0.45)",
                opacity: roundStateOpacity(round.state),
              }}
            />
          ))}
        </div>
      ) : (
        <span style={{ fontSize: "20px", color: "rgba(226,232,240,0.85)" }}>{detail}</span>
      )}
    </div>
  );
}

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const payload = parsePayload(searchParams.get("data"));

  if (!payload || !payload.event) {
    return new Response("Invalid share card payload", { status: 400 });
  }

  const event = payload.event;
  const theme = getShareThemeConfig(payload.theme ?? undefined);
  const coverSrc = await loadCoverDataUrl(payload.cover);
  const streak = Math.max(0, payload.streak ?? 0);
  const title = payload.title?.trim() || "GuessSenpai Daily";

  const svg = await satori(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          padding: "48px",
          background: theme.background,
          color: theme.textColor,
          fontFamily: "DejaVuSans",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: theme.overlay,
            mixBlendMode: "overlay",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "24px",
            zIndex: 1,
            maxWidth: "760px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <span
              style={{
                fontSize: "20px",
                letterSpacing: "0.3em",
                textTransform: "uppercase",
                opacity: 0.8,
              }}
            >
              GuessSenpai Daily
            </span>
            <h1
              style={{
                fontSize: "56px",
                fontWeight: 700,
                lineHeight: 1.1,
                textShadow: "0 0 32px rgba(15,23,42,0.35)",
              }}
            >
              {title}
            </h1>
            <p style={{ fontSize: "24px", color: "rgba(248,250,252,0.88)" }}>
              {event.formattedDate}
            </p>
          </div>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px 20px",
                borderRadius: "9999px",
                border: `1px solid ${theme.accent}55`,
                background: "rgba(15,23,42,0.35)",
                fontSize: "22px",
                fontWeight: 600,
              }}
            >
              <span style={{ fontSize: "28px" }}>🔥</span>
              <span>Streak {streak}</span>
            </div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px 20px",
                borderRadius: "9999px",
                border: "1px solid rgba(248,250,252,0.35)",
                background: "rgba(15,23,42,0.35)",
                fontSize: "22px",
              }}
            >
              <span>🎮 {event.games.filter((game) => game.status === "completed").length}</span>
              <span>completed</span>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            {event.games.map((game) => renderGameRow(game, theme.accent))}
          </div>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            {event.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "8px 16px",
                  borderRadius: "9999px",
                  border: "1px solid rgba(248,250,252,0.35)",
                  background: "rgba(15,23,42,0.35)",
                  fontSize: "20px",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div
          style={{
            position: "relative",
            width: "360px",
            height: "100%",
            borderRadius: "36px",
            overflow: "hidden",
            border: "1px solid rgba(248,250,252,0.25)",
            boxShadow: "0 25px 55px rgba(15,23,42,0.45)",
            zIndex: 1,
            background: "rgba(15,23,42,0.55)",
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
                color: "rgba(226,232,240,0.75)",
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
                "linear-gradient(180deg, rgba(15,23,42,0.1) 0%, rgba(15,23,42,0.65) 100%)",
            }}
          />
        </div>
      </div>
    ),
    {
      width: size.width,
      height: size.height,
      fonts: [
        {
          name: "DejaVuSans",
          data: await loadFont(FONT_REGULAR_PATH),
          weight: 400,
          style: "normal",
        },
        {
          name: "DejaVuSans",
          data: await loadFont(FONT_BOLD_PATH),
          weight: 700,
          style: "normal",
        },
      ],
    },
  );

  const resvg = new Resvg(svg, {
    fitTo: {
      mode: "width",
      value: size.width,
    },
  });
  const png = resvg.render().asPng();
  return new Response(png, {
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=86400",
    },
  });
}
