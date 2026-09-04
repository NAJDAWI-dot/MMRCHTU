"use client";

import { type ButtonHTMLAttributes, forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  /**
   * `md` is the default and is deliberately identical to what every button on
   * the site used before sizes existed, so adding this prop moved nothing.
   */
  size?: "sm" | "md" | "lg";
  /** Render as the single child element (e.g. a Next.js <Link>) instead of a <button>. */
  asChild?: boolean;
}

/**
 * Sizing stays padding-based rather than a fixed height.
 *
 * A fixed `h-10` would clip any button whose label wraps — and several already
 * carry a `min-h-[44px]` override for the touch target, which a fixed height
 * would fight rather than cooperate with.
 */
const SIZE_CLASSES: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

/**
 * The lit top edge on the filled variants.
 *
 * `bg-ras-purple` sets background-color and `bg-gradient-to-b` sets
 * background-image, so the two stack rather than compete: the solid brand
 * colour underneath, a barely-there highlight over it. It survives the hover
 * colour change for free, because only the colour beneath is being swapped.
 */
const SHEEN = "bg-gradient-to-b from-white/[0.15] to-transparent";

const VARIANT_CLASSES: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: `bg-ras-purple text-white shadow-sm hover:bg-mood-plum hover:shadow-md ${SHEEN}`,
  secondary: `bg-ras-crimson text-white shadow-sm hover:bg-mood-garnet hover:shadow-md ${SHEEN}`,
  ghost:
    "border border-ras-purple/40 bg-transparent text-ras-purple hover:border-ras-purple/60 hover:bg-ras-purple/10 hover:shadow-sm dark:border-white/30 dark:text-white dark:hover:border-white/50 dark:hover:bg-white/10",
  /**
   * Quiet until you are about to press it.
   *
   * Outlined rather than filled specifically so it does not read as `secondary`,
   * which is already solid crimson — two solid crimson buttons side by side
   * would say the same thing about "Save" and "Delete for ever". It fills only
   * on hover, at the point the pointer is committed to it.
   */
  destructive:
    "border border-ras-crimson/40 bg-transparent text-accent hover:border-ras-crimson hover:bg-ras-crimson hover:text-white hover:shadow-md dark:border-rose-400/40 dark:text-rose-300 dark:hover:border-mood-rose dark:hover:bg-mood-rose dark:hover:text-white",
};

/**
 * The focus ring is the button's own, not the global one.
 *
 * `globals.css` draws a purple `:focus-visible` outline on everything. Against
 * the dark theme's near-black background that purple sits at roughly 1.9:1,
 * which is not a visible focus indicator. This swaps to white in dark mode and
 * keeps the offset painted in the page colour, so the ring reads on both.
 */
const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ras-purple focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)] dark:focus-visible:ring-white";

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", asChild = false, className = "", ...props },
  ref
) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      // active:scale is the whole reason this transitions transform as well as
      // colour: it gives every button on the site the sense of being pressed
      // rather than merely re-coloured. The hover lift is the other half of the
      // same idea — it rises to meet the pointer and drops back under the
      // press. Both are excluded under reduced motion, where a control that
      // moves under the pointer is exactly what is unwanted.
      className={`inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-[background-color,border-color,box-shadow,transform,color] duration-200 ease-out hover:-translate-y-px active:translate-y-0 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100 ${FOCUS} ${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
});
