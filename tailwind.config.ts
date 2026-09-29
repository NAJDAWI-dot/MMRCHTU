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
    /*
      Tailwind's own radii, each scaled by --inf-round. Unset, that is 1 and
      every corner is what it always was; in the week before competition day
      it falls a stage at a time, and the site's corners square off into the
      day site's cells (src/styles/infection.css). Circles stay circles.
    */
    borderRadius: {
      none: "0px",
      sm: "calc(0.125rem * var(--inf-round, 1))",
      DEFAULT: "calc(0.25rem * var(--inf-round, 1))",
      md: "calc(0.375rem * var(--inf-round, 1))",
      lg: "calc(0.5rem * var(--inf-round, 1))",
      xl: "calc(0.75rem * var(--inf-round, 1))",
      "2xl": "calc(1rem * var(--inf-round, 1))",
      "3xl": "calc(1.5rem * var(--inf-round, 1))",
      full: "9999px",
    },
    extend: {
      colors: {
        /*
          The brand colours are read through variables (src/styles/tokens.css)
          so the week before competition day can move them towards the day
          site's palette (src/lib/infection.ts). Their values are exactly the
          ones below the rest of the year.
        */
        white: "rgb(var(--rgb-white) / <alpha-value>)",
        ras: {
          // IEEE RAS official palette (RAS Logos.pdf brand guidelines)
          crimson: "rgb(var(--rgb-ras-crimson) / <alpha-value>)", // #862633, Pantone 202C
          purple: "rgb(var(--rgb-ras-purple) / <alpha-value>)", // #5F2167, Pantone 2623
          gray: "rgb(var(--rgb-ras-gray) / <alpha-value>)", // #57565B, PMS Cool Gray 11C
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
          plum: "rgb(var(--rgb-mood-plum) / <alpha-value>)", // #611169
          garnet: "rgb(var(--rgb-mood-garnet) / <alpha-value>)", // #97012D
          rose: "rgb(var(--rgb-mood-rose) / <alpha-value>)", // #A11640
          orchid: "rgb(var(--rgb-mood-orchid) / <alpha-value>)", // #732E7D
          violet: "rgb(var(--rgb-mood-violet) / <alpha-value>)", // #82468C
          amethyst: "rgb(var(--rgb-mood-amethyst) / <alpha-value>)", // #74347D
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
