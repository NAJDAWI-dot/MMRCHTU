import { Logo } from "@/components/brand/Logo";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-ras-gray/15 bg-[var(--color-surface)]">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-8 text-center">
        <Logo variant="lockup" enforceMinSize={false} className="h-16" />
        <p className="max-w-md text-sm text-ras-gray dark:text-white/70">
          MMRC 26 is organized by the IEEE Robotics &amp; Automation Society, HTU Student
          Chapter.
        </p>
        <p className="text-xs text-ras-gray/70 dark:text-white/50">
          © {new Date().getFullYear()} IEEE RAS HTU Student Chapter.
        </p>
      </div>
    </footer>
  );
}
