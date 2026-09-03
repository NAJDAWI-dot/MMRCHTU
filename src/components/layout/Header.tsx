import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/brand/ThemeToggle";
import { Nav } from "@/components/layout/Nav";

export function Header() {
  return (
    // `relative` anchors the phone menu panel, which spans the header's full
    // width rather than dropping out of the button in a cramped column — and
    // now also the rule along the bottom edge.
    //
    // That rule replaces a 1px ras-gray/15 hairline, which at that opacity was
    // invisible against either background and left the header floating with no
    // edge at all. The shadow does the separating on a light background; the
    // rule is what makes the edge deliberate rather than incidental.
    //
    // Translucent rather than solid, so the background image runs behind it and
    // the artwork's top corners are not sliced off by a bar across the top of
    // every page. The blur is what keeps the nav legible over whatever part of
    // the image happens to be under it.
    <header className="relative bg-[var(--color-bg-translucent)] shadow-[0_4px_16px_-10px_rgba(95,33,103,0.45)] backdrop-blur-md dark:shadow-none">
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
      {/*
        The edge itself: brand purple through to brand crimson, fading at both
        ends so it reads as a rule under the content rather than as a bar
        painted wall to wall. Inside the header rather than a border on it, so
        the phone menu (top-full) still opens flush beneath.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-ras-purple/25 via-ras-crimson/70 to-ras-purple/25 dark:from-mood-violet/40 dark:via-mood-rose/80 dark:to-mood-violet/40"
      />
    </header>
  );
}
