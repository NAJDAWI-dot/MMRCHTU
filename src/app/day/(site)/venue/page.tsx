import type { Metadata } from "next";
import { DayIcon } from "@/components/day-site/icons";
import { GuideView, PageHead } from "@/components/day-site/ui";
import { loadGuide } from "@/lib/day-guide-server";
import { loadDaySite } from "@/lib/day-site";
import { requireDayViewer } from "@/lib/day-access";

export const revalidate = 300;
export const metadata: Metadata = { title: "Venue" };

export default async function DayVenuePage() {
  await requireDayViewer();
  const [guide, site] = await Promise.all([loadGuide("venue"), loadDaySite()]);
  return (
    <div className="space-y-12">
      <PageHead kicker={guide.kicker} title={guide.title} />
      {site.venue || site.dateText ? (
        <div className="day-card day-posts grid grid-cols-[minmax(0,1fr)] gap-px overflow-hidden bg-day-line/[0.12] sm:grid-cols-2">
          {[
            site.venue ? { label: "Where", value: site.venue, icon: "pin" as const } : null,
            site.dateText ? { label: "When", value: site.dateText, icon: "schedule" as const } : null,
          ]
            .filter((item): item is { label: string; value: string; icon: "pin" | "schedule" } => item !== null)
            .map((item, index) => (
              <div key={item.label} className="flex items-start gap-4 bg-day-surface p-6" data-reveal style={{ ["--i" as string]: index }}>
                <DayIcon name={item.icon} className="mt-0.5 h-6 w-6 shrink-0 text-day-crimson" />
                <span>
                  <span className="block text-sm font-semibold text-day-muted">{item.label}</span>
                  <span className="day-display mt-1 block text-2xl text-day-ink sm:text-3xl">{item.value}</span>
                </span>
              </div>
            ))}
        </div>
      ) : null}
      <GuideView blocks={guide.blocks} />
    </div>
  );
}
