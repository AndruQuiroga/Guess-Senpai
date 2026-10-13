import type { Config } from "tailwindcss";

/**
 * Semantic colours resolve to CSS variables declared on :root in
 * src/styles/globals.css (the single source of truth). Opacity modifiers
 * (e.g. `bg-signal/50`) are intentionally unsupported; use a token instead.
 */
const v = (name: string) => `var(--${name})`;

export default {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-sm)",
        DEFAULT: "var(--radius)",
        lg: "var(--radius)",
        xl: "var(--radius)",
        "2xl": "var(--radius)",
        "3xl": "var(--radius)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        display: ["var(--font-display)"],
      },
      colors: {
        ink: v("ink"),
        panel: { DEFAULT: v("panel"), raised: v("panel-raised") },
        hover: v("hover"),
        line: {
          DEFAULT: v("line"),
          subtle: v("line-subtle"),
          strong: v("line-strong"),
        },
        paper: v("paper"),
        muted: v("muted"),
        focus: v("focus"),
        signal: {
          DEFAULT: v("signal"),
          hover: v("signal-hover"),
          text: v("signal-text"),
          soft: v("signal-soft"),
          deep: v("signal-deep"),
          ink: v("signal-ink"),
        },
        correct: {
          DEFAULT: v("correct"),
          soft: v("correct-soft"),
          ink: v("correct-ink"),
        },
        close: {
          DEFAULT: v("close"),
          soft: v("close-soft"),
          ink: v("close-ink"),
        },
        wrong: {
          DEFAULT: v("wrong"),
          soft: v("wrong-soft"),
          ink: v("wrong-ink"),
        },
        danger: {
          DEFAULT: v("danger"),
          soft: v("danger-soft"),
          ink: v("danger-ink"),
        },
        info: {
          DEFAULT: v("info"),
          soft: v("info-soft"),
          ink: v("info-ink"),
        },
        // Legacy aliases kept for existing utilities; prefer the tokens above.
        brand: {
          50: "#fff1ed",
          100: "#ffe1d9",
          200: "#ffc2b3",
          300: "#ffa18b",
          400: "#ff896e",
          500: "#ff7658",
          600: "#e95c3e",
          700: "#b8422a",
          800: "#70291c",
          900: "#3a1d17",
        },
        surface: {
          base: v("ink"),
          raised: v("panel-raised"),
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
