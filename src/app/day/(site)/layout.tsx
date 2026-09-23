import Link from "next/link";
import { notFound } from "next/navigation";
import { DayAutoRefresh } from "@/components/day/DayAutoRefresh";
import { DayAlerts } from "@/components/day-site/DayAlerts";
import { DayMotion } from "@/components/day-site/DayMotion";
import { ChapterLogo, DayHeader } from "@/components/day-site/DayNav";
import { DAY_SPLASH_SCRIPT, DaySplash } from "@/components/day-site/DaySplash";
import { canViewDaySite } from "@/lib/day-access";
import { loadDayShell } from "@/lib/day-shell";

/**
 * The public day site's frame.
 *
 * The access check lives here so no page under it can forget it. Anyone the
 * audience setting does not cover gets "not found", the same answer as a page
 * that does not exist, so a private day site gives nothing away.
 */
export default async function DaySiteLayout({ children }: { children: React.ReactNode }) {
  if (!(await canViewDaySite())) notFound();
  const { alerts, isPublic } = await loadDayShell();

  return (
    <>
      {/* Before the splash is drawn: hide it for a visit that has already seen it. */}
      <script dangerouslySetInnerHTML={{ __html: DAY_SPLASH_SCRIPT }} />
      <DaySplash />
      <DayMotion />
      <DayAutoRefresh />
      <DayAlerts alerts={alerts} />
      <DayHeader isPublic={isPublic} />

      <main id="main" className="day-enter mx-auto max-w-7xl px-4 pb-32 pt-8 sm:px-6 sm:pt-12 lg:pb-24">
        {children}
      </main>

      <footer className="relative border-t border-day-line/[0.08] pb-28 lg:pb-0">
        <div className="day-checker h-3 opacity-[0.08]" aria-hidden="true" />
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="flex items-start gap-4">
            <ChapterLogo className="h-16 w-16 shrink-0" />
            <div>
              <p className="font-brand text-2xl text-day-ink">MMRC 26</p>
              <p className="mt-1 max-w-xs text-sm text-day-muted">
                The Micromouse Robotics Competition, run by the IEEE RAS HTU Student Chapter.
              </p>
            </div>
          </div>
          <nav aria-label="The day">
            <p className="day-kicker">The day</p>
            <ul className="mt-3 space-y-2 text-sm">
              {[
                ["/day/standings", "Standings"],
                ["/day/bracket", "Bracket"],
                ["/day/schedule", "Schedule"],
                ["/day/competitors", "For competitors"],
                ["/day/venue", "Getting there"],
              ].map(([href, label]) => (
                <li key={href}>
                  <Link href={href!} className="text-day-muted transition-colors hover:text-day-ink">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="More from MMRC">
            <p className="day-kicker">More</p>
            <ul className="mt-3 space-y-2 text-sm">
              {[
                ["/faq", "FAQ"],
                ["/micromouse", "How a micromouse works"],
                ["/game", "Pac Mouse"],
                ["/gallery", "Photos"],
              ].map(([href, label]) => (
                <li key={href}>
                  <Link href={href!} className="text-day-muted transition-colors hover:text-day-ink">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </footer>
    </>
  );
}
