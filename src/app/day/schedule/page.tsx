import type { Metadata } from "next";
import { PageHead } from "@/components/day-site/ui";
import { loadDaySite } from "@/lib/day-site";
import { clockTime } from "@/lib/day-mode";

export const revalidate = 30;
export const metadata: Metadata = { title: "Schedule" };

/** The running order for the day, knowing where "now" is. */
export default async function DaySchedulePage() {
  const site = await loadDaySite();

  return (
    <div className="space-y-10">
      <PageHead kicker="Times are Amman time" title="Running order" lead={site.venue ? `At ${site.venue}.` : undefined} />
      {site.timeline.length ? (
        <ol className="relative ml-3 space-y-4 border-l-2 border-white/10 pl-8">
          {site.timeline.map((item, index) => {
            const live = item.state === "now";
            const past = item.state === "past";
            return (
              <li
                key={item.id}
                className={`day-rise relative ${past ? "opacity-50" : ""}`}
                style={{ ["--i" as string]: index }}
              >
                <span
                  aria-hidden="true"
                  className={`absolute -left-[42px] top-5 h-4 w-4 rounded-full border-2 ${
                    live
                      ? "border-[var(--day-rose)] bg-[var(--day-rose)] shadow-[0_0_18px_var(--day-rose)]"
                      : past
                        ? "border-white/30 bg-white/30"
                        : "border-[var(--day-gold)] bg-[#07030b]"
                  }`}
                />
                <div className={`day-glass p-5 ${live ? "border-[var(--day-rose)]/50" : ""}`}>
                  <p className="flex flex-wrap items-center gap-3 font-mono text-sm text-[var(--day-muted)]">
                    <span className="text-white">
                      {clockTime(item.startsAt)}
                      {item.endsAt ? ` to ${clockTime(item.endsAt)}` : ""}
                    </span>
                    {live ? (
                      <span className="inline-flex items-center gap-2 rounded-full bg-[var(--day-rose)]/15 px-2.5 py-0.5 text-xs font-semibold uppercase text-[var(--day-rose)]">
                        <span className="day-live-dot" aria-hidden="true" />
                        Now
                      </span>
                    ) : past ? (
                      <span className="text-xs uppercase">Done</span>
                    ) : null}
                  </p>
                  <p className="mt-1 font-display text-2xl font-extrabold text-white">{item.title}</p>
                  {item.location ? <p className="mt-1 text-sm text-[var(--day-gold)]">{item.location}</p> : null}
                  {item.description ? <p className="mt-2 max-w-2xl text-[var(--day-muted)]">{item.description}</p> : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="day-glass p-6 text-[var(--day-muted)]">The running order goes up here once it is set.</p>
      )}
    </div>
  );
}
