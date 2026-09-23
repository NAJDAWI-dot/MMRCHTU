import type { Metadata } from "next";
import { DayIcon } from "@/components/day-site/icons";
import { GuideView, PageHead } from "@/components/day-site/ui";
import { loadGuide } from "@/lib/day-guide-server";
import { loadDaySite } from "@/lib/day-site";

export const revalidate = 300;
export const metadata: Metadata = { title: "Venue" };

export default async function DayVenuePage() {
  const [guide, site] = await Promise.all([loadGuide("venue"), loadDaySite()]);
  return (
    <div className="space-y-12">
      <PageHead kicker={guide.kicker} title={guide.title} />
      {site.venue || site.dateText ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
          {[
            site.venue ? { label: "Where", value: site.venue, icon: "pin" as const } : null,
            site.dateText ? { label: "When", value: site.dateText, icon: "schedule" as const } : null,
          ]
            .filter((item): item is { label: string; value: string; icon: "pin" | "schedule" } => item !== null)
            .map((item, index) => (
              <div key={item.label} className="day-card flex items-center gap-5 p-6" data-reveal style={{ ["--i" as string]: index }}>
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-day-crimson/10 text-day-crimson">
                  <DayIcon name={item.icon} className="h-7 w-7" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-day-muted">{item.label}</span>
                  <span className="day-display mt-1 block text-2xl text-day-ink sm:text-3xl">{item.value}</span>
                </span>
              </div>
            ))}
        </div>
      ) : null}
      <div className="day-card p-6 sm:p-10">
        <GuideView blocks={guide.blocks} />
      </div>
    </div>
  );
}
