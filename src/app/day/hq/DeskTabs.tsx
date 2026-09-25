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
      <ul className="flex w-max">
        {desks.map((desk) => {
          const active = desk.href === current;
          return (
            <li key={desk.href} className="relative">
              <Link
                href={desk.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-11 items-center gap-2 px-3 text-sm font-semibold transition-colors ${active ? "text-day-ink" : "text-day-muted hover:text-day-ink"}`}
              >
                <DayIcon name={desk.icon} className={`h-4 w-4 ${active ? "text-day-crimson" : ""}`} />
                {desk.label}
              </Link>
              {active ? <span className="absolute inset-x-2 -bottom-px h-[3px] bg-day-crimson" aria-hidden="true" /> : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
