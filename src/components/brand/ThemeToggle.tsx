"use client";

import { useTheme } from "@/components/brand/ThemeProvider";

export function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={resolvedTheme === "dark"}
      className="rounded-md border border-ras-gray/30 px-3 py-1.5 text-sm font-medium text-ras-purple transition-colors hover:bg-ras-purple/10 dark:text-white dark:hover:bg-white/10"
    >
      {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
    </button>
  );
}
