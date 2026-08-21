"use client";

import { useTheme } from "@/components/brand/ThemeProvider";

export function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={resolvedTheme === "dark"}
      className="rounded-md border border-ras-gray/30 px-3 py-1.5 text-sm font-medium text-ras-purple transition-[background-color,transform] duration-200 hover:bg-ras-purple/10 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100 dark:text-white dark:hover:bg-white/10"
    >
      {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
    </button>
  );
}
