"use client";

import { type ButtonHTMLAttributes, forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  /** Render as the single child element (e.g. a Next.js <Link>) instead of a <button>. */
  asChild?: boolean;
}

const VARIANT_CLASSES: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-ras-purple text-white hover:bg-mood-plum",
  secondary: "bg-ras-crimson text-white hover:bg-mood-garnet",
  ghost: "bg-transparent text-ras-purple border border-ras-purple/40 hover:bg-ras-purple/10 dark:text-white dark:border-white/30 dark:hover:bg-white/10",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", asChild = false, className = "", ...props },
  ref
) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      // active:scale is the whole reason this transitions transform as well as
      // colour: it gives every button on the site the sense of being pressed
      // rather than merely re-coloured. Excluded under reduced motion, where a
      // control that moves under the pointer is exactly what is unwanted.
      className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition-[background-color,color,box-shadow,transform] duration-200 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
});
