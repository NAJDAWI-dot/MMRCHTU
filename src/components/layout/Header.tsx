import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/brand/ThemeToggle";
import { Nav } from "@/components/layout/Nav";

export function Header() {
  return (
    // `relative` anchors the phone menu panel, which spans the header's full
    // width rather than dropping out of the button in a cramped column.
    <header className="relative border-b border-ras-gray/15 bg-[var(--color-bg)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:gap-4">
        <Link href="/" className="flex min-w-0 items-center gap-2 sm:gap-3" aria-label="MMRC 26 home">
          <Logo enforceMinSize={false} className="h-9 shrink-0 sm:h-10" />
          <span className="truncate font-display text-base font-bold text-ras-purple dark:text-white sm:text-lg">
            MMRC&nbsp;26
          </span>
        </Link>
        {/* Nav renders both the desktop row and the phone menu, each revealing
            itself at the right width, so nothing here needs to hide either. */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Nav />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
