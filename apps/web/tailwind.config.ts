import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      borderRadius: { "2xl": "1.25rem", "3xl": "1.75rem" },
      fontFamily: {
        sans: ["'Inter'", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["'Space Grotesk'", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e3a8a",
          900: "#172554",
        },
        surface: {
          base: "rgba(12,17,36,0.85)",
          raised: "rgba(19,27,45,0.72)",
        },
      },
      boxShadow: {
        glow: "0 25px 65px -20px rgba(59, 130, 246, 0.45)",
        ambient: "0 30px 80px -40px rgba(15, 23, 42, 0.8)",
      },
      backgroundImage: {
        "aurora": "radial-gradient(circle at 20% 20%, rgba(59,130,246,0.35), transparent 45%), radial-gradient(circle at 80% 0%, rgba(236,72,153,0.25), transparent 40%), radial-gradient(circle at 50% 80%, rgba(34,211,238,0.25), transparent 45%)",
        "grid-dark": "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
} satisfies Config;
