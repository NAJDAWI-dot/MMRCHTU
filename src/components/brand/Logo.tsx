"use client";

import { useTheme } from "@/components/brand/ThemeProvider";

// IEEE RAS contrast rule: never white-on-light or black-on-dark. Light/dark
// mode must swap to a different pre-colored SVG variant, not recolor one
// file with CSS, so the mark's internal crimson/purple stays correct.
const VARIANTS = {
  light: "/brand/logo/ra-mark-full-color.png",
  dark: "/brand/logo/ra-mark-white-on-black.png",
} as const;

const LOCKUP_VARIANTS = {
  light: "/brand/logo/lockup-htu-chapter.png",
  dark: "/brand/logo/lockup-htu-chapter-white.png",
} as const;

interface LogoProps {
  className?: string;
  /** Full chapter lockup (mark + "HTU Student Chapter" text) vs the mark alone. */
  variant?: "mark" | "lockup";
  /** Set false only for small nav-bar usage, where the guideline's minimum
   * clear-space rule doesn't apply the same way as a standalone placement. */
  enforceMinSize?: boolean;
}

export function Logo({ className = "", variant = "mark", enforceMinSize = true }: LogoProps) {
  const { resolvedTheme } = useTheme();
  const src = variant === "lockup" ? LOCKUP_VARIANTS[resolvedTheme] : VARIANTS[resolvedTheme];
  const sizeClass = enforceMinSize ? "min-h-logo-clear" : "";

  return (
    // eslint-disable-next-line @next/next/no-img-element -- brand SVGs are static, no need for next/image optimization
    <img
      src={src}
      alt="IEEE RAS HTU Student Chapter"
      className={`${sizeClass} w-auto p-2 ${className}`}
    />
  );
}
