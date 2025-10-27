export type ShareCardTheme = "twilight" | "sunrise" | "aurora";

export interface ShareThemeConfig {
  id: ShareCardTheme;
  label: string;
  previewGradient: string;
  background: string;
  overlay: string;
  accent: string;
  textColor: string;
}

export const SHARE_CARD_THEMES: ShareThemeConfig[] = [
  {
    id: "twilight",
    label: "Twilight Prism",
    previewGradient:
      "linear-gradient(135deg, rgba(79,70,229,0.85) 0%, rgba(30,64,175,0.9) 50%, rgba(15,23,42,0.95) 100%)",
    background:
      "radial-gradient(circle at 20% -10%, rgba(99,102,241,0.85), rgba(15,23,42,0.95) 55%), linear-gradient(135deg, rgba(13,148,136,0.2), rgba(15,23,42,0.9))",
    overlay:
      "linear-gradient(135deg, rgba(148,163,184,0.2), rgba(15,23,42,0.6))",
    accent: "#8b5cf6",
    textColor: "#f8fafc",
  },
  {
    id: "sunrise",
    label: "Sunrise Bloom",
    previewGradient:
      "linear-gradient(135deg, rgba(249,115,22,0.9) 0%, rgba(236,72,153,0.85) 50%, rgba(30,41,59,0.92) 100%)",
    background:
      "radial-gradient(circle at 15% -10%, rgba(251,191,36,0.75), rgba(124,58,237,0.4) 40%, rgba(15,23,42,0.95) 80%)",
    overlay:
      "linear-gradient(135deg, rgba(236,72,153,0.2), rgba(30,41,59,0.65))",
    accent: "#fb923c",
    textColor: "#fff7ed",
  },
  {
    id: "aurora",
    label: "Aurora Flux",
    previewGradient:
      "linear-gradient(135deg, rgba(34,211,238,0.85) 0%, rgba(129,140,248,0.85) 45%, rgba(15,23,42,0.92) 100%)",
    background:
      "radial-gradient(circle at 80% 0%, rgba(20,184,166,0.7), rgba(15,23,42,0.95) 60%), linear-gradient(160deg, rgba(79,70,229,0.3), rgba(15,23,42,0.8))",
    overlay:
      "linear-gradient(180deg, rgba(15,23,42,0.1), rgba(15,23,42,0.55))",
    accent: "#22d3ee",
    textColor: "#f1f5f9",
  },
];

export const DEFAULT_SHARE_THEME: ShareThemeConfig = SHARE_CARD_THEMES[0];

export function getShareThemeConfig(id: ShareCardTheme | string | null | undefined): ShareThemeConfig {
  const theme = SHARE_CARD_THEMES.find((entry) => entry.id === id);
  return theme ?? DEFAULT_SHARE_THEME;
}
