import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/brand/ThemeToggle";
import { Nav } from "@/components/layout/Nav";

export function Header() {
  return (
    <header className="border-b border-ras-gray/15 bg-[var(--color-bg)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-3" aria-label="MMRC 26 home">
          <Logo enforceMinSize={false} className="h-10" />
          <span className="font-display text-lg font-bold text-ras-purple dark:text-white">
            MMRC&nbsp;26
          </span>
        </Link>
        <div className="hidden md:block">
          <Nav />
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}
