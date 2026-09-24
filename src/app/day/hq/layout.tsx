import type { Metadata } from "next";
import Link from "next/link";
import { DayIcon } from "@/components/day-site/icons";
import { ThemeSwitch, Wordmark } from "@/components/day-site/DayNav";
import { requireAdmin } from "@/lib/auth";
import { ROLE_LABELS, parseRoles } from "@/lib/roles";
import { DeskTabs } from "./DeskTabs";
import { openDaySite } from "@/lib/day-links";

export const metadata: Metadata = { title: { default: "Day HQ", template: "%s | Day HQ" }, robots: { index: false } };

/**
 * Day HQ: the competition day's admin, inside the day site and in its design.
 *
 * Any signed-in admin gets the frame; each desk checks its own role, and so
 * does every action behind it. When the day site goes public, /admin sends
 * admins here; the classic admin is always one link away for everything the
 * day does not need.
 */
export default async function DayHqLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const roles = parseRoles(admin.roles);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-day-line/[0.08] bg-day-bg/80 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <Wordmark href="/day/hq" label="Day HQ" />
          <div className="flex items-center gap-2">
            <a href={openDaySite("/day")} className="day-btn day-btn-soft day-btn-sm hidden sm:inline-flex">
              <DayIcon name="live" className="h-4 w-4" />
              Day site
            </a>
            <Link href="/admin?classic=1" className="day-btn day-btn-soft day-btn-sm hidden md:inline-flex">
              <DayIcon name="gear" className="h-4 w-4" />
              Classic admin
            </Link>
            <ThemeSwitch />
            <form action="/admin/logout" method="post">
              <button type="submit" className="day-btn day-btn-soft day-btn-sm" title={`Signed in as ${admin.username}`}>
                Sign out
              </button>
            </form>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <DeskTabs roles={roles} />
        </div>
      </header>

      <main className="day-enter mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 sm:pt-10">{children}</main>

      <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 pb-10 text-xs text-day-faint sm:px-6">
        <span>
          Signed in as <span className="font-semibold text-day-muted">{admin.username}</span>
          {roles.length ? ` · ${roles.map((role) => ROLE_LABELS[role]).join(", ")}` : " · no role yet"}
        </span>
        <span className="flex gap-4">
          <a href={openDaySite("/day")} className="hover:text-day-ink sm:hidden">
            Day site
          </a>
          <Link href="/admin?classic=1" className="hover:text-day-ink">
            Classic admin
          </Link>
        </span>
      </footer>
    </div>
  );
}
