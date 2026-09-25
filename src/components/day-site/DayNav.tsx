"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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

/** A layout effect in the browser; nothing on the server, where there is no layout. */
const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const isActive = (pathname: string, href: string) => (href === "/day" ? pathname === "/day" : pathname.startsWith(href));

export function ThemeSwitch() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="grid h-10 w-10 place-items-center rounded-[6px] border border-day-line/[0.14] text-day-ink transition-colors hover:border-day-line/30 hover:bg-day-ink/[0.05]"
    >
      <DayIcon name={dark ? "sun" : "moon"} className="h-[18px] w-[18px]" />
    </button>
  );
}

export function Wordmark({ href = "/day", label = "Competition day" }: { href?: string; label?: string }) {
  return (
    <Link href={href} className="group flex min-w-0 items-center gap-3" aria-label={`MMRC 26 ${label}`}>
      <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-[4px]" style={{ backgroundColor: MMRC_PLATE }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo/mmrc-mark.png" alt="" width={28} height={28} className="h-7 w-7 object-contain" />
      </span>
      <span className="min-w-0 leading-none">
        <span className="block font-brand text-[1.15rem] text-day-ink">MMRC 26</span>
        <span className="mt-1 block truncate text-[0.75rem] font-semibold text-day-muted">{label}</span>
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
 * The wall under the current page in the bar: it slides from one page to the
 * next rather than blinking, so the eye follows where it went.
 */
function useWallUnder(active: string | null) {
  const items = useRef(new Map<string, HTMLElement>());
  const [wall, setWall] = useState<{ left: number; width: number } | null>(null);
  const measure = useCallback(() => {
    const node = active ? items.current.get(active) : undefined;
    setWall(node ? { left: node.offsetLeft, width: node.offsetWidth } : null);
  }, [active]);
  useBrowserLayoutEffect(measure, [measure]);
  useEffect(() => {
    window.addEventListener("resize", measure);
    // Archivo arriving changes the widths.
    document.fonts?.ready.then(measure).catch(() => {});
    return () => window.removeEventListener("resize", measure);
  }, [measure]);
  const register = useCallback(
    (key: string) => (node: HTMLElement | null) => {
      if (node) items.current.set(key, node);
      else items.current.delete(key);
    },
    [],
  );
  return { wall, register };
}

/**
 * The day site's header, and on a phone its tab bar.
 *
 * On a laptop: the name, the six pages people look at all day, "More" for the
 * guides, the theme switch and the chapter's logo, with a crimson wall under
 * the page you are on. On a phone the first four become a tab bar docked to
 * the bottom edge, where a thumb is; the fifth tab opens a sheet with the rest.
 */
export function DayHeader({ isPublic }: { isPublic: boolean }) {
  const pathname = usePathname() ?? "";
  const [moreOpen, setMoreOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const moreActive = DAY_MORE.some((item) => isActive(pathname, item.href));
  const activeKey = moreActive ? "more" : (DAY_PRIMARY.find((item) => isActive(pathname, item.href))?.href ?? null);
  const { wall, register } = useWallUnder(activeKey);

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

  const sheetActive = moreActive || isActive(pathname, "/day/schedule") || isActive(pathname, "/day/news");

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-day-line/[0.12] bg-day-bg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Wordmark />

          <nav aria-label="Competition day" className="relative hidden h-full lg:block">
            <ul className="flex h-full items-stretch">
              {DAY_PRIMARY.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href} ref={register(item.href)}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex h-full items-center gap-2 px-3.5 text-[0.925rem] font-semibold transition-colors ${
                        active ? "text-day-ink" : "text-day-muted hover:text-day-ink"
                      }`}
                    >
                      {item.href === "/day" ? <span className="day-live-dot" aria-hidden="true" /> : null}
                      {item.label}
                    </Link>
                  </li>
                );
              })}
              <li ref={register("more")}>
                <div ref={moreRef} className="relative h-full">
                  <button
                    type="button"
                    aria-expanded={moreOpen}
                    onClick={() => setMoreOpen((open) => !open)}
                    className={`flex h-full items-center gap-1.5 px-3.5 text-[0.925rem] font-semibold transition-colors ${
                      moreActive || moreOpen ? "text-day-ink" : "text-day-muted hover:text-day-ink"
                    }`}
                  >
                    More
                    <svg viewBox="0 0 12 12" className={`h-3 w-3 transition-transform duration-200 ${moreOpen ? "rotate-180" : ""}`} aria-hidden="true">
                      <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
                    </svg>
                  </button>
                  {moreOpen ? (
                    <div className="day-dialog day-card absolute right-0 top-[calc(100%+1px)] w-80 py-1.5 shadow-[var(--day-shadow-lift)]">
                      {DAY_MORE.map((item) => {
                        const active = isActive(pathname, item.href);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            aria-current={active ? "page" : undefined}
                            className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-day-ink/[0.05]"
                          >
                            <DayIcon name={item.icon} className={`mt-0.5 h-[18px] w-[18px] shrink-0 ${active ? "text-day-crimson" : "text-day-muted"}`} />
                            <span>
                              <span className="block text-sm font-semibold text-day-ink">{item.label}</span>
                              <span className="block text-[0.8125rem] text-day-muted">{item.hint}</span>
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </li>
            </ul>
            {wall ? (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-px h-[3px] bg-day-crimson transition-[left,width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
                style={{ left: wall.left + 10, width: Math.max(0, wall.width - 20) }}
              />
            ) : null}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            {isPublic ? null : (
              <span
                className="day-chip hidden min-h-[1.9rem] bg-day-gold/[0.14] px-2.5 text-day-gold sm:inline-flex"
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
          <div className="day-progress h-full bg-day-crimson" />
        </div>
      </header>

      {/* The phone's tab bar, docked to the bottom edge. */}
      <nav
        aria-label="Competition day, tabs"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-day-line/[0.14] bg-day-surface lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="grid grid-cols-5">
          {DAY_PRIMARY.slice(0, 4).map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href} className="relative">
                {active ? <span className="absolute inset-x-4 top-0 h-[3px] bg-day-crimson" aria-hidden="true" /> : null}
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-[3.75rem] flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors ${
                    active ? "text-day-ink" : "text-day-muted"
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
          <li className="relative">
            {sheetActive ? <span className="absolute inset-x-4 top-0 h-[3px] bg-day-crimson" aria-hidden="true" /> : null}
            <button
              type="button"
              aria-expanded={sheetOpen}
              onClick={() => setSheetOpen(true)}
              className={`flex h-[3.75rem] w-full flex-col items-center justify-center gap-1 text-[11px] font-semibold ${
                sheetOpen || sheetActive ? "text-day-ink" : "text-day-muted"
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
          <div
            className="day-sheet absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-[14px] border-t border-day-line/[0.14] bg-day-surface pb-[env(safe-area-inset-bottom)]"
            data-lenis-prevent
          >
            <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-day-line/20" aria-hidden="true" />
            <ul className="mt-2 divide-y divide-day-line/[0.1] px-2">
              {[...DAY_PRIMARY.slice(4), ...DAY_MORE].map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className="flex min-h-[3.5rem] items-center gap-3.5 rounded-[4px] px-3 py-2.5 active:bg-day-ink/[0.05]"
                    >
                      <DayIcon name={item.icon} className={`h-[22px] w-[22px] shrink-0 ${active ? "text-day-crimson" : "text-day-muted"}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-day-ink">{item.label}</span>
                        {item.hint ? <span className="block truncate text-[0.8125rem] text-day-muted">{item.hint}</span> : null}
                      </span>
                      {active ? <span className="h-2 w-2 bg-day-crimson" aria-hidden="true" /> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="m-3 flex items-center justify-between rounded-[4px] bg-day-sunk p-2 pl-4">
              <span className="text-sm font-semibold text-day-ink">Light or dark</span>
              <ThemeSwitch />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
