import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { LEGAL_PAGES, type LegalSlug } from "@/lib/mdx";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-ras-gray/15 bg-[var(--color-surface)]">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-8 text-center">
        <Logo variant="lockup" enforceMinSize={false} className="h-16" />
        <p className="max-w-md text-sm text-ras-gray dark:text-white/70">
          MMRC 26 is organized by the IEEE Robotics &amp; Automation Society, HTU Student
          Chapter.
        </p>

        {/* Reachable from every page, which is the point of putting them here:
            somebody about to pay a fee should not have to hunt for the refund
            policy. */}
        <nav aria-label="Policies">
          <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs">
            {(Object.keys(LEGAL_PAGES) as LegalSlug[]).map((slug) => (
              <li key={slug}>
                <Link
                  href={`/legal/${slug}`}
                  className="text-ras-gray underline-offset-2 transition-colors duration-200 hover:text-ras-purple hover:underline motion-reduce:transition-none dark:text-white/70 dark:hover:text-white"
                >
                  {LEGAL_PAGES[slug]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <p className="text-xs text-ras-gray/70 dark:text-white/50">
          © {new Date().getFullYear()} IEEE RAS HTU Student Chapter.
        </p>
      </div>

      {/* The last line on every page. Separated from the chapter's own credit
          above it so the two are not read as one sentence. */}
      <div className="border-t border-ras-gray/10 px-4 py-4 text-center">
        <p className="font-display text-sm font-bold tracking-[0.35em] text-ras-purple dark:text-white/80">
          NAJDAWI
        </p>
      </div>
    </footer>
  );
}
