"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DayIcon } from "@/components/day-site/icons";
import { canOpen, type AdminRole } from "@/lib/roles";
import { DESKS } from "./desks";

/** The strip under the HQ header: only the desks this admin opens. */
export function DeskTabs({ roles }: { roles: readonly AdminRole[] }) {
  const pathname = usePathname() ?? "";
  const desks = DESKS.filter((desk) => canOpen(roles, desk.href));
  // The longest matching href wins, so the bracket is not also "Qualifying".
  const current = desks
    .filter((desk) => pathname === desk.href || pathname.startsWith(`${desk.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav aria-label="Day HQ desks" className="day-no-scrollbar -mx-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
      <ul className="flex w-max gap-1 pb-3">
        {desks.map((desk) => {
          const active = desk.href === current;
          return (
            <li key={desk.href}>
              <Link
                href={desk.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-semibold transition-colors ${
                  active ? "bg-day-ink text-day-on-ink" : "text-day-muted hover:bg-day-ink/5 hover:text-day-ink"
                }`}
              >
                <DayIcon name={desk.icon} className="h-4 w-4" />
                {desk.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
