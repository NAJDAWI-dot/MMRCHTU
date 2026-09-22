import Link from "next/link";
import { canOpen, type AdminRole } from "@/lib/roles";

export const DESKS = [
  { href: "/admin/day", label: "Overview", blurb: "Everything at a glance." },
  { href: "/admin/day/check-in", label: "Check-in", blurb: "Arrivals, inspection, pits and withdrawals." },
  { href: "/admin/day/scoring", label: "Qualifying", blurb: "Record runs and watch the table." },
  { href: "/admin/day/scoring/bracket", label: "Bracket", blurb: "Draw the top 32 and enter every result." },
  { href: "/admin/day/announcements", label: "Announcements", blurb: "Notices on the live page." },
  { href: "/admin/day/guides", label: "Guides", blurb: "The competitor, volunteer, organizer and venue pages." },
  { href: "/admin/day/volunteers", label: "Volunteers", blurb: "Who is where, and when." },
  { href: "/admin/day-mode", label: "Access", blurb: "Who can open the day site." },
] as const;

/** The strip across the top of every desk: only the desks this admin opens. */
export function DeskTabs({ roles, current }: { roles: readonly AdminRole[]; current: string }) {
  const desks = DESKS.filter((desk) => canOpen(roles, desk.href));
  return (
    <nav aria-label="Day HQ desks" className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
      {desks.map((desk) => {
        const active = desk.href === current;
        return (
          <Link
            key={desk.href}
            href={desk.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "border-ras-purple bg-ras-purple text-white dark:border-white/30 dark:bg-white/15"
                : "border-ras-gray/25 text-ras-gray hover:border-ras-purple/50 hover:text-ras-purple dark:border-white/15 dark:text-white/70 dark:hover:text-white"
            }`}
          >
            {desk.label}
          </Link>
        );
      })}
    </nav>
  );
}
