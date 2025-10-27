import { ImageResponse } from "next/og";
import { formatShareDate } from "../../utils/shareText";

export const runtime = "edge";
export const alt = "GuessSenpai daily share card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface SimplifiedProgress {
  completed?: boolean;
  attempts?: number;
  round?: number;
  clearedRounds?: number;
  totalRounds?: number;
  unitLabel?: string;
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
    redacted_synopsis?: SimplifiedProgress | null;
    guess_the_opening?: SimplifiedProgress | null;
  } | null;
}

function parsePayload(value: string | null): ShareCardPayload | null {
  if (!value) return null;
  try { return JSON.parse(value) as ShareCardPayload; } catch { return null; }
}

function describeAnidle(p?: SimplifiedProgress | null) {
  if (!p) return "Anidle — ⏳";
  const attempts = Math.max(0, p.attempts ?? 0);
  if (!p.completed) return attempts ? `Anidle — ${attempts} ${attempts === 1 ? "try" : "tries"}` : "Anidle — In progress";
  const done = Math.max(1, attempts);
  return `Anidle — ${done} ${done === 1 ? "try" : "tries"} ✅`;
}
function describeRoundGame(label: string, p?: SimplifiedProgress | null) {
  if (!p) return `${label} — ⏳`;
  const total = Math.max(1, Math.floor(p.totalRounds ?? 3));
  const unit = p.unitLabel?.trim();
  const cleared = p.clearedRounds ?? (p.completed ? total : undefined);
  const progressCount =
    cleared !== undefined
      ? Math.max(0, Math.min(total, cleared))
      : Math.max(1, Math.min(total, p.round ?? 1));

  if (p.completed) {
    return `${label} — ✅ (${progressCount}/${total}${unit ? ` ${unit}` : ""})`;
  }

  return `${label} — ${progressCount}/${total}${unit ? ` ${unit}` : ""}`;
}

function toBase64FromArrayBuffer(ab: ArrayBuffer): string {
  const bytes = new Uint8Array(ab);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);

  // Use btoa on Edge/Browser builds
  if (typeof (globalThis as any).btoa === "function") {
    return (globalThis as any).btoa(bin);
  }

  // Fallback for Node builds (won’t run in Edge; just here for type/build safety)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodeBuffer: typeof import("node:buffer").Buffer | undefined =
    (globalThis as any).Buffer ?? undefined;
  if (nodeBuffer) {
    // @ts-ignore Buffer type might not be in lib; safe at runtime in Node
    return nodeBuffer.from(bytes).toString("base64");
  }

  throw new Error("No base64 encoder available in this runtime");
}

async function loadCoverDataUrl(url?: string | null) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/jpeg";
    const ab = await res.arrayBuffer();
    return `data:${type};base64,${toBase64FromArrayBuffer(ab)}`;
  } catch { return null; }
}

// NOTE: Metadata image routes use a default export that returns ImageResponse.
export default async function Image(req: Request) {
  const { searchParams } = new URL(req.url);
  const payload = parsePayload(searchParams.get("data"));
  if (!payload) return new Response("Invalid share card payload", { status: 400 });

  const formattedDate = payload.date ? formatShareDate(payload.date) : null;
  const title = payload.title?.trim() || "GuessSenpai Daily";
  const streak = payload.streak ?? 0;
  const includeOpening = !!payload.includeGuessTheOpening;
  const progress = payload.progress ?? {};
  const coverSrc = await loadCoverDataUrl(payload.cover);

  const stats = [
    describeAnidle(progress.anidle ?? null),
    describeRoundGame("Poster Zoomed", progress.poster_zoomed ?? null),
    describeRoundGame("Redacted Synopsis", progress.redacted_synopsis ?? null),
    ...(includeOpening ? [describeRoundGame("Guess the Opening", progress.guess_the_opening ?? null)] : []),
  ];

  return new ImageResponse(
    (
      <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "row", justifyContent: "space-between", padding: "48px", background: "radial-gradient(circle at top left, rgba(59,130,246,0.6), rgba(14,23,42,0.95))", color: "white", fontFamily: "'Inter','Helvetica Neue',Helvetica,Arial,sans-serif", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(15,23,42,0.65))", mixBlendMode: "overlay", pointerEvents: "none" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", zIndex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={{ fontSize: "20px", letterSpacing: "0.3em", textTransform: "uppercase", opacity: 0.85 }}>GuessSenpai Daily</span>
            <h1 style={{ fontSize: "54px", fontWeight: 700, lineHeight: 1.1, maxWidth: "620px" }}>{title}</h1>
            {formattedDate ? <p style={{ fontSize: "22px", color: "rgba(226,232,240,0.85)" }}>{formattedDate}</p> : null}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "12px", padding: "12px 20px", borderRadius: "9999px", border: "1px solid rgba(252,211,77,0.45)", background: "rgba(251,191,36,0.22)", color: "#FEF3C7", fontSize: "22px", fontWeight: 600 }}>
              <span style={{ fontSize: "26px" }}>🔥</span><span>Streak {Math.max(0, streak)}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "20px", borderRadius: "24px", background: "rgba(15,23,42,0.55)", border: "1px solid rgba(148,163,184,0.3)", backdropFilter: "blur(16px)", minWidth: "480px" }}>
              {stats.map((line) => <p key={line} style={{ fontSize: "22px", display: "flex", alignItems: "center" }}><span style={{ opacity: 0.85 }}>{line}</span></p>)}
            </div>
          </div>
        </div>
        <div style={{ position: "relative", width: "360px", height: "100%", borderRadius: "36px", overflow: "hidden", border: "1px solid rgba(148,163,184,0.4)", boxShadow: "0 25px 55px rgba(15,23,42,0.45)", zIndex: 1, background: "rgba(148,163,184,0.12)" }}>
          {coverSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverSrc} alt="Cover art" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: "28px", color: "rgba(226,232,240,0.7)" }}>Cover unavailable</div>
          )}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(15,23,42,0.05) 0%, rgba(15,23,42,0.55) 100%)" }} />
        </div>
      </div>
    ),
    { ...size }
  );
}
