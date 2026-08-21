import { type HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Lifts on hover.
   *
   * Opt-in rather than automatic: a card that rises under the pointer is a
   * promise that something happens if you click it. Most cards on the site are
   * plain containers for text, and giving those the same behaviour would be
   * telling the visitor something untrue.
   */
  interactive?: boolean;
}

export function Card({ className = "", interactive = false, ...props }: CardProps) {
  return (
    <div
      className={`rounded-lg border border-ras-gray/20 bg-[var(--color-surface)] p-6 shadow-sm transition-[box-shadow,transform,border-color] duration-200 motion-reduce:transition-none ${
        interactive
          ? "hover:-translate-y-0.5 hover:border-ras-purple/30 hover:shadow-md motion-reduce:hover:translate-y-0"
          : ""
      } ${className}`}
      {...props}
    />
  );
}
