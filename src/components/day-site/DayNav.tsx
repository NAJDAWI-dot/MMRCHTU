"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const DAY_NAV = [
  { href: "/day", label: "Live" },
  { href: "/day/teams", label: "Teams" },
  { href: "/day/standings", label: "Standings" },
  { href: "/day/bracket", label: "Bracket" },
  { href: "/day/schedule", label: "Schedule" },
  { href: "/day/news", label: "News" },
  { href: "/day/competitors", label: "Competitors" },
  { href: "/day/volunteers", label: "Volunteers" },
  { href: "/day/organizers", label: "Organizers" },
  { href: "/day/venue", label: "Venue" },
] as const;

/**
 * The day site's menu: one scrolling row of pills on every screen size.
 * Ten destinations do not fit a phone any other way without hiding half of
 * them behind a button, and on the day people want to see where they can go.
 */
export function DayNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav aria-label="Competition day" className="day-ticker -mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
      <ul className="flex w-max gap-1.5 py-1">
        {DAY_NAV.map((item) => {
          const active = item.href === "/day" ? pathname === "/day" : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-white text-[#1a0b1f] shadow-[0_0_24px_-4px_rgba(242,169,0,0.6)]"
                    : "text-[var(--day-muted)] hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.href === "/day" ? <span className="day-live-dot" aria-hidden="true" /> : null}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
