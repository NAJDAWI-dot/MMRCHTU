import { type HTMLAttributes } from "react";

export function Badge({ className = "", ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-ras-purple/10 px-2.5 py-0.5 text-xs font-medium text-ras-purple dark:bg-white/10 dark:text-white ${className}`}
      {...props}
    />
  );
}
