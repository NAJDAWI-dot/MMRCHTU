"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/components/brand/ThemeProvider";
import { DayIcon, type DayIconName } from "@/components/day-site/icons";
import { MMRC_PLATE } from "@/lib/brand";

interface NavItem {
  href: string;
  label: string;
  icon: DayIconName;
  hint?: string;
}

/** The pages everyone wants: in the bar on a laptop, in the tab bar on a phone. */
export const DAY_PRIMARY: readonly NavItem[] = [
  { href: "/day", label: "Live", icon: "live" },
  { href: "/day/teams", label: "Teams", icon: "teams" },
  { href: "/day/standings", label: "Standings", icon: "standings" },
  { href: "/day/bracket", label: "Bracket", icon: "bracket" },
  { href: "/day/schedule", label: "Schedule", icon: "schedule" },
  { href: "/day/news", label: "News", icon: "news" },
];

/** Everything else, behind "More". */
export const DAY_MORE: readonly NavItem[] = [
  { href: "/day/photos", label: "Photos", icon: "camera", hint: "Pictures from the hall as they are taken" },
  { href: "/day/competitors", label: "Competitors", icon: "flag", hint: "Check-in, the match, the rules on the day" },
  { href: "/day/volunteers", label: "Volunteers", icon: "hand", hint: "Stations, shifts and who is where" },
  { href: "/day/organizers", label: "Organizers", icon: "badge", hint: "The committee running the day" },
  { href: "/day/venue", label: "Venue", icon: "pin", hint: "Getting there and finding your way" },
];

export const DAY_NAV = [...DAY_PRIMARY, ...DAY_MORE];

const isActive = (pathname: string, href: string) => (href === "/day" ? pathname === "/day" : pathname.startsWith(href));

export function ThemeSwitch() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="grid h-10 w-10 place-items-center rounded-full border border-day-line/10 bg-day-surface/70 text-day-ink transition-colors hover:bg-day-surface"
    >
      <DayIcon name={dark ? "sun" : "moon"} className="h-[18px] w-[18px]" />
    </button>
  );
}

export function Wordmark({ href = "/day", label = "Competition day" }: { href?: string; label?: string }) {
  return (
    <Link href={href} className="group flex min-w-0 items-center gap-3" aria-label={`MMRC 26 ${label}`}>
      <span className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl ring-1 ring-day-line/15" style={{ backgroundColor: MMRC_PLATE }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo/mmrc-mark.png" alt="" width={28} height={28} className="h-7 w-7 object-contain" />
      </span>
      <span className="min-w-0 leading-none">
        <span className="block font-brand text-[1.15rem] text-day-ink">MMRC 26</span>
        <span className="day-kicker mt-1 block truncate text-[0.62rem]">{label}</span>
      </span>
    </Link>
  );
}

/** The chapter's lockup, in the ink that suits the theme. */
export function ChapterLogo({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo/lockup-htu-chapter.png" alt="IEEE RAS HTU Student Chapter" width={80} height={80} className={`${className} object-contain dark:hidden`} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo/lockup-htu-chapter-white.png" alt="IEEE RAS HTU Student Chapter" width={80} height={80} className={`${className} hidden object-contain dark:block`} />
    </>
  );
}

/**
 * The day site's header, and on a phone its tab bar.
 *
 * On a laptop: the name, the six pages people look at all day, "More" for the
 * four guides, the theme switch and the chapter's logo. On a phone the first
 * four become a tab bar along the bottom, where a thumb is, like a sports app;
 * the fifth tab opens a sheet with everything else.
 */
export function DayHeader({ isPublic }: { isPublic: boolean }) {
  const pathname = usePathname() ?? "";
  const [moreOpen, setMoreOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMoreOpen(false);
    setSheetOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (event: MouseEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) setMoreOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSheetOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  const moreActive = DAY_MORE.some((item) => isActive(pathname, item.href));
  const sheetActive = moreActive || isActive(pathname, "/day/schedule") || isActive(pathname, "/day/news");

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-day-line/[0.08] bg-day-bg/75 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Wordmark />

          <nav aria-label="Competition day" className="hidden lg:block">
            <ul className="flex items-center gap-1 rounded-full border border-day-line/[0.08] bg-day-surface/60 p-1">
              {DAY_PRIMARY.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-semibold transition-colors ${
                        active ? "bg-day-ink text-day-on-ink" : "text-day-muted hover:bg-day-ink/5 hover:text-day-ink"
                      }`}
                    >
                      {item.href === "/day" ? <span className="day-live-dot" aria-hidden="true" /> : null}
                      {item.label}
                    </Link>
                  </li>
                );
              })}
              <li>
                <div ref={moreRef} className="relative">
                  <button
                    type="button"
                    aria-expanded={moreOpen}
                    onClick={() => setMoreOpen((open) => !open)}
                    className={`flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors ${
                      moreActive ? "bg-day-ink text-day-on-ink" : "text-day-muted hover:bg-day-ink/5 hover:text-day-ink"
                    }`}
                  >
                    More
                    <svg viewBox="0 0 12 12" className={`h-3 w-3 transition-transform ${moreOpen ? "rotate-180" : ""}`} aria-hidden="true">
                      <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </button>
                  {moreOpen ? (
                    <div className="day-dialog day-card absolute right-0 top-12 w-80 p-2">
                      {DAY_MORE.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="flex items-start gap-3 rounded-2xl p-3 transition-colors hover:bg-day-ink/5"
                        >
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-day-crimson/10 text-day-crimson">
                            <DayIcon name={item.icon} className="h-[18px] w-[18px]" />
                          </span>
                          <span>
                            <span className="block text-sm font-semibold text-day-ink">{item.label}</span>
                            <span className="block text-xs text-day-muted">{item.hint}</span>
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              </li>
            </ul>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            {isPublic ? null : (
              <span
                className="hidden items-center gap-1.5 rounded-full border border-day-gold/40 bg-day-gold/10 px-3 py-1.5 text-xs font-semibold text-day-gold sm:inline-flex"
                title="Only the admins allowed on the Day Site Access screen can see this"
              >
                <DayIcon name="lock" className="h-3.5 w-3.5" />
                Private preview
              </span>
            )}
            <ThemeSwitch />
            <span className="hidden xl:block">
              <ChapterLogo />
            </span>
          </div>
        </div>
        <div className="h-[2px]" aria-hidden="true">
          <div className="day-progress day-stripe-x h-full" />
        </div>
      </header>

      {/* The phone's tab bar. */}
      <nav
        aria-label="Competition day, tabs"
        className="fixed inset-x-3 bottom-3 z-40 rounded-[1.4rem] border border-day-line/10 bg-day-surface/85 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.5)] backdrop-blur-xl backdrop-saturate-150 lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="grid grid-cols-5">
          {DAY_PRIMARY.slice(0, 4).map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-[3.6rem] flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors ${
                    active ? "text-day-crimson" : "text-day-muted"
                  }`}
                >
                  <span className="relative">
                    <DayIcon name={item.icon} className="h-[22px] w-[22px]" />
                    {item.href === "/day" ? <span className="day-live-dot absolute -right-1 -top-0.5 scale-75" aria-hidden="true" /> : null}
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              aria-expanded={sheetOpen}
              onClick={() => setSheetOpen(true)}
              className={`flex h-[3.6rem] w-full flex-col items-center justify-center gap-1 text-[11px] font-semibold ${
                sheetOpen || sheetActive ? "text-day-crimson" : "text-day-muted"
              }`}
            >
              <DayIcon name="more" className="h-[22px] w-[22px]" />
              More
            </button>
          </li>
        </ul>
      </nav>

      {sheetOpen ? (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="All pages">
          <button type="button" aria-label="Close" className="day-dialog-backdrop absolute inset-0" onClick={() => setSheetOpen(false)} />
          <div className="day-dialog day-card absolute inset-x-3 bottom-3 max-h-[80vh] overflow-y-auto p-3" data-lenis-prevent>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-day-line/20" aria-hidden="true" />
            <ul className="grid grid-cols-2 gap-2">
              {[...DAY_PRIMARY.slice(4), ...DAY_MORE].map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex h-full flex-col gap-3 rounded-2xl p-4 ${active ? "bg-day-ink text-day-on-ink" : "bg-day-sunk text-day-ink"}`}
                    >
                      <DayIcon name={item.icon} className="h-6 w-6" />
                      <span className="text-sm font-semibold">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 flex items-center justify-between rounded-2xl bg-day-sunk p-3 pl-4">
              <span className="text-sm font-semibold text-day-ink">Light or dark</span>
              <ThemeSwitch />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
