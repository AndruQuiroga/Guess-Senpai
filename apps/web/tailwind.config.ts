import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      borderRadius: { "2xl": "0.625rem", "3xl": "0.625rem" },
      fontFamily: {
        sans: ["'Inter'", "ui-sans-serif", "system-ui", "sans-serif"],
        display: [
          "'Space Grotesk'",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      colors: {
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
          base: "#171819",
          raised: "#242628",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
