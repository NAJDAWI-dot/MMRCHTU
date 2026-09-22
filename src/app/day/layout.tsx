import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MmrcLogo } from "@/components/brand/MmrcLogo";
import { DayAutoRefresh } from "@/components/day/DayAutoRefresh";
import { DayNav } from "@/components/day-site/DayNav";
import { canViewDaySite } from "@/lib/day-access";
import { loadDayShell } from "@/lib/day-shell";
import "@/styles/day.css";

export const metadata: Metadata = {
  title: { default: "Competition Day", template: "%s | MMRC 26 Competition Day" },
  description: "Live from MMRC 26: the bracket, the standings, every team and everything you need on the day.",
};

/**
 * The competition day site's frame.
 *
 * The access check lives here so no page under /day can forget it. Anyone the
 * audience setting does not cover gets "not found", the same answer as a page
 * that does not exist, so a private day site gives nothing away.
 */
export default async function DayLayout({ children }: { children: React.ReactNode }) {
  if (!(await canViewDaySite())) notFound();
  const { ticker, isPublic } = await loadDayShell();

  return (
    <div className="day-root">
      <div className="day-floor" aria-hidden="true" />
      <DayAutoRefresh />

      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#07030b]/70 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex items-center justify-between gap-3 pt-3">
            <Link href="/day" className="flex min-w-0 items-center gap-3" aria-label="MMRC 26 competition day, live">
              <MmrcLogo markOnly size="h-9" />
              <span className="min-w-0">
                <span className="block font-display text-lg font-extrabold leading-none tracking-tight text-white">
                  MMRC 26
                </span>
                <span className="day-kicker mt-1 block truncate">Competition day</span>
              </span>
            </Link>
            <div className="flex shrink-0 items-center gap-2">
              {isPublic ? null : (
                <span
                  className="rounded-full border border-[var(--day-gold)]/50 bg-[var(--day-gold)]/10 px-3 py-1 text-xs font-semibold text-[var(--day-gold)]"
                  title="Only the admins allowed on the Day Site Access screen can see this"
                >
                  Private preview
                </span>
              )}
              <span className="hidden items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white sm:inline-flex">
                <span className="day-live-dot" aria-hidden="true" />
                Live
              </span>
            </div>
          </div>
          <div className="mt-2">
            <DayNav />
          </div>
        </div>

        {ticker.length ? (
          <div className="day-ticker overflow-hidden border-t border-white/[0.06] bg-black/20" aria-label="Latest">
            <div className="day-ticker-track py-1.5">
              {[0, 1].map((copy) => (
                <ul key={copy} className="flex shrink-0 items-center" aria-hidden={copy === 1 ? "true" : undefined}>
                  {ticker.map((item) => (
                    <li key={`${copy}-${item.id}`} className="flex items-center gap-2 whitespace-nowrap px-5 text-[13px]">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${item.kind === "result" ? "bg-[var(--day-mint)]" : "bg-[var(--day-gold)]"}`}
                        aria-hidden="true"
                      />
                      <span className={item.kind === "result" ? "font-mono text-white/85" : "text-white/80"}>{item.text}</span>
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          </div>
        ) : null}
      </header>

      <div className="mx-auto max-w-7xl px-4 pb-20 pt-8 sm:pt-10">{children}</div>

      <footer className="border-t border-white/[0.07] py-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 text-sm text-[var(--day-faint)]">
          <p>MMRC 26 · IEEE RAS HTU Student Chapter</p>
          <nav aria-label="More" className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/faq" className="hover:text-white">
              FAQ
            </Link>
            <Link href="/micromouse" className="hover:text-white">
              How a micromouse works
            </Link>
            <Link href="/game" className="hover:text-white">
              Pac Mouse
            </Link>
            <Link href="/gallery" className="hover:text-white">
              Photos
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
