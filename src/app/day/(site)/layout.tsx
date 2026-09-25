import Link from "next/link";
import { notFound } from "next/navigation";
import { DayAutoRefresh } from "@/components/day/DayAutoRefresh";
import { DayAlerts } from "@/components/day-site/DayAlerts";
import { DayMotion } from "@/components/day-site/DayMotion";
import { DayHeader } from "@/components/day-site/DayNav";
import { DAY_SPLASH_SCRIPT, DaySplash } from "@/components/day-site/DaySplash";
import { canViewDaySite } from "@/lib/day-access";
import { loadDayShell } from "@/lib/day-shell";
import { FollowDock } from "@/components/day-site/Follow";
import { FinishMouse } from "@/components/day-site/DayMice";
import { loadQueue } from "@/lib/day-queue";
import { followCards } from "@/lib/follow";
import { loadPublicCompetition } from "@/lib/public-competition";
import { JustRevealed } from "@/components/day-site/JustRevealed";
import { recentReveal } from "@/lib/reveal";
import { getCompetitionDayConfig } from "@/lib/site-config";

/**
 * The public day site's frame.
 *
 * The access check lives here so no page under it can forget it. Anyone the
 * audience setting does not cover gets "not found", the same answer as a page
 * that does not exist, so a private day site gives nothing away.
 */
export default async function DaySiteLayout({ children }: { children: React.ReactNode }) {
  if (!(await canViewDaySite())) notFound();
  const [{ alerts, isPublic }, state, queue, config] = await Promise.all([loadDayShell(), loadPublicCompetition(), loadQueue(), getCompetitionDayConfig()]);

  return (
    <>
      {/* Before the splash is drawn: hide it for a visit that has already seen it. */}
      <script dangerouslySetInnerHTML={{ __html: DAY_SPLASH_SCRIPT }} />
      <DaySplash />
      <DayMotion />
      <DayAutoRefresh />
      <DayAlerts alerts={alerts} />
      <DayHeader isPublic={isPublic} />
      <JustRevealed last={recentReveal(config.lastReveal, Date.now())} />
      <FollowDock cards={followCards(state, queue)} />

      <main id="main" className="day-enter mx-auto max-w-7xl px-4 pb-32 pt-8 sm:px-6 sm:pt-12 lg:pb-24">
        {children}
      </main>

      {/* The finish: the maze floor, with a chequered line across the top. */}
      <footer className="day-floor relative rounded-none pb-24 lg:pb-0">
        {/* Cheddar dancing on the finish line, in the space under the page. */}
        <FinishMouse />
        <div className="day-checker h-3 opacity-80" style={{ ["--size" as string]: "6px" }} aria-hidden="true" />
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-6 md:grid-cols-[1.6fr_1fr_1fr] md:py-16">
          <div>
            <p className="font-brand text-[2.6rem] leading-none text-day-ink">MMRC 26</p>
            <p className="mt-4 max-w-sm leading-relaxed text-day-muted">
              The Micromouse Robotics Competition, run by the IEEE RAS HTU Student Chapter at Al Hussein Technical University.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo/lockup-htu-chapter-white.png" alt="IEEE RAS HTU Student Chapter" width={80} height={80} className="mt-7 h-14 w-14 object-contain" />
          </div>
          {[
            {
              label: "The day",
              links: [
                ["/day/standings", "Standings"],
                ["/day/bracket", "Bracket"],
                ["/day/schedule", "Schedule"],
                ["/day/competitors", "For competitors"],
                ["/day/venue", "Getting there"],
              ],
            },
            {
              label: "More from MMRC",
              links: [
                ["/faq", "FAQ"],
                ["/micromouse", "How a micromouse works"],
                ["/game", "Pac Mouse"],
                ["/gallery", "Photos"],
              ],
            },
          ].map((group) => (
            <nav key={group.label} aria-label={group.label}>
              <p className="flex items-center gap-2 text-sm font-semibold text-day-muted">
                <span className="h-1.5 w-1.5 bg-day-crimson" aria-hidden="true" />
                {group.label}
              </p>
              <ul className="mt-4 space-y-1">
                {group.links.map(([href, label]) => (
                  <li key={href}>
                    <Link href={href!} className="inline-flex min-h-[2.25rem] items-center font-semibold text-day-ink underline-offset-4 hover:underline">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </footer>
    </>
  );
}
