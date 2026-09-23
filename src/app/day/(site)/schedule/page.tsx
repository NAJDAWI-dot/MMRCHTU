import type { Metadata } from "next";
import { Empty, PageHead } from "@/components/day-site/ui";
import { clockTime } from "@/lib/day-mode";
import { loadDaySite } from "@/lib/day-site";
import { requireDayViewer } from "@/lib/day-access";

export const revalidate = 30;
export const metadata: Metadata = { title: "Schedule" };

/**
 * The running order for the day, knowing where "now" is: the one the
 * organisers write on the Competition Day screen, or until they do, the season
 * schedule's events on the day.
 */
export default async function DaySchedulePage() {
  await requireDayViewer();
  const site = await loadDaySite();
  const nowIndex = site.timeline.findIndex((item) => item.state === "now");

  return (
    <div className="space-y-12">
      <PageHead
        kicker="Times are Amman time"
        title="Running order"
        lead={[site.dateText, site.venue].filter(Boolean).join(" · ") || undefined}
      />
      {site.timeline.length ? (
        <ol className="relative mx-auto max-w-4xl">
          {site.timeline.map((item, index) => {
            const live = item.state === "now";
            const past = item.state === "past";
            const progress =
              live && item.endsAt
                ? Math.min(1, Math.max(0, (site.now.getTime() - item.startsAt.getTime()) / (item.endsAt.getTime() - item.startsAt.getTime())))
                : null;
            return (
              <li
                key={item.id}
                className="relative grid grid-cols-[4.5rem_1.5rem_minmax(0,1fr)] gap-3 pb-4 sm:grid-cols-[6rem_2rem_minmax(0,1fr)] sm:gap-5"
                data-reveal
                style={{ ["--i" as string]: index % 6 }}
              >
                <div className={`day-num pt-5 text-right ${past ? "text-day-faint" : "text-day-ink"}`}>
                  <span className="day-display block text-xl sm:text-2xl">{clockTime(item.startsAt)}</span>
                  {item.endsAt ? <span className="block text-xs text-day-faint">to {clockTime(item.endsAt)}</span> : null}
                </div>
                <div className="relative flex justify-center" aria-hidden="true">
                  <span className={`absolute bottom-0 top-0 w-0.5 ${index < nowIndex || past ? "bg-day-crimson/40" : "bg-day-line/10"}`} />
                  <span
                    className={`relative mt-6 h-4 w-4 rounded-full border-4 ${
                      live ? "border-day-live bg-day-surface shadow-[0_0_0_6px_rgb(var(--day-live)/0.18)]" : past ? "border-day-crimson/50 bg-day-crimson/50" : "border-day-line/25 bg-day-surface"
                    }`}
                  />
                </div>
                <div className={`day-card p-5 sm:p-6 ${live ? "ring-2 ring-day-live/50" : ""} ${past ? "opacity-60" : ""}`}>
                  {live ? (
                    <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-day-live">
                      <span className="day-live-dot" aria-hidden="true" />
                      Happening now
                    </p>
                  ) : null}
                  <p className="day-display text-2xl text-day-ink sm:text-3xl">{item.title}</p>
                  {item.location ? <p className="mt-1.5 text-sm font-semibold text-day-crimson">{item.location}</p> : null}
                  {item.description ? <p className="mt-2 max-w-2xl leading-relaxed text-day-muted">{item.description}</p> : null}
                  {progress !== null ? (
                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-day-ink/10">
                      <div className="h-full rounded-full bg-day-live" style={{ width: `${Math.round(progress * 100)}%` }} />
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <Empty icon="schedule" title="The running order is on its way">
          The organisers publish the day&rsquo;s timings on the Competition Day page, and they appear here as soon as they do.
        </Empty>
      )}
    </div>
  );
}
