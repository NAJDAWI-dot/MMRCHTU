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
        /*
          Brand accent for TEXT, and only text.

          ras.crimson is the brand ink and stays exactly what the guidelines
          say. But #862633 on a dark surface is 2.1:1, and on the background
          artwork it falls to 1.0:1 — the words disappear. So text takes this
          token instead, which is the crimson in the light theme and a light
          tint of it, at the same hue, in the dark one. Backgrounds, borders
          and gradients keep using ras.crimson directly: they are not being
          read, so they do not need to clear a contrast threshold.

          Written as rgb(var(--x) / <alpha-value>) rather than a plain var,
          which is what lets `text-accent/70` still work.
        */
        accent: "rgb(var(--color-accent-rgb) / <alpha-value>)",
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
        // Only the early-bird badge and banner use this. Tahoma is the fallback
        // because it is the one Arabic-capable face present on effectively every
        // Windows machine, which is most of the audience.
        arabic: ["var(--font-arabic)", "Tahoma", "sans-serif"],
      },
      minHeight: {
        "logo-clear": "139px", // ~36.8mm @ 96dpi, IEEE RAS min on-screen size
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
} satisfies Config;
