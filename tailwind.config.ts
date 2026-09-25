import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/**/*.{ts,tsx,mdx}",
    "./content/**/*.mdx",
  ],
  /*
    Class-based dark mode, except inside `.book-light`. The rulebook's pages are
    printed paper in both themes, and the diagrams bound into them carry dark:
    variants written for the site's dark cards — white ink that would vanish on
    the page. Opting a subtree out here keeps those components unchanged.
    Same `:is(.dark *)` shape Tailwind's "class" strategy generates, so
    specificity everywhere else is what it was.
  */
  darkMode: ["variant", "&:is(.dark *):not(.book-light *)"],
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
        /*
          The competition day site. Every value is a theme variable set in
          src/styles/day.css, chalk in light and the maze floor at night, so a
          day page never names a colour that only works in one theme.
        */
        day: {
          bg: "rgb(var(--day-bg) / <alpha-value>)",
          surface: "rgb(var(--day-surface) / <alpha-value>)",
          sunk: "rgb(var(--day-sunk) / <alpha-value>)",
          ink: "rgb(var(--day-ink) / <alpha-value>)",
          muted: "rgb(var(--day-muted) / <alpha-value>)",
          faint: "rgb(var(--day-faint) / <alpha-value>)",
          line: "rgb(var(--day-line) / <alpha-value>)",
          crimson: "rgb(var(--day-crimson) / <alpha-value>)",
          plum: "rgb(var(--day-plum) / <alpha-value>)",
          gold: "rgb(var(--day-gold) / <alpha-value>)",
          live: "rgb(var(--day-live) / <alpha-value>)",
          good: "rgb(var(--day-good) / <alpha-value>)",
          // Text on a solid ink fill: the page colour, flipped.
          "on-ink": "rgb(var(--day-on-ink) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "system-ui"],
        // The MMRC 26 wordmark only. Bevan is a heavy slab, so the fallback is a
        // serif rather than the sans the rest of the site falls back to.
        brand: ["var(--font-brand)", "Rockwell", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        // Only the early-bird badge and banner use this. Tahoma is the fallback
        // because it is the one Arabic-capable face present on effectively every
        // Windows machine, which is most of the audience.
        arabic: ["var(--font-arabic)", "Tahoma", "sans-serif"],
        // The competition day site's headings and numbers: Archivo, run wide.
        day: ["var(--font-day)", "var(--font-sans)", "system-ui", "sans-serif"],
      },
      minHeight: {
        "logo-clear": "139px", // ~36.8mm @ 96dpi, IEEE RAS min on-screen size
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
} satisfies Config;
