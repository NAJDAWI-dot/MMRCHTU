import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/**/*.{ts,tsx,mdx}",
    "./content/**/*.mdx",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ras: {
          // IEEE RAS official palette (RAS Logos.pdf brand guidelines)
          crimson: "#862633", // Pantone 202C
          purple: "#5F2167", // Pantone 2623
          gray: "#57565B", // PMS Cool Gray 11C
        },
        mood: {
          // secondary moodboard palette, decorative use only (see a11y notes)
          plum: "#611169",
          garnet: "#97012D",
          rose: "#A11640",
          orchid: "#732E7D",
          violet: "#82468C",
          amethyst: "#74347D",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "system-ui"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      minHeight: {
        "logo-clear": "139px", // ~36.8mm @ 96dpi, IEEE RAS min on-screen size
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
} satisfies Config;
