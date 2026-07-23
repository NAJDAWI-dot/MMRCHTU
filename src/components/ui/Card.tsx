import { type HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-lg border border-ras-gray/20 bg-[var(--color-surface)] p-6 shadow-sm ${className}`}
      {...props}
    />
  );
}
