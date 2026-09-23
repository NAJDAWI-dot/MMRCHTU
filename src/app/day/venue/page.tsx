import type { Metadata } from "next";
import { GuideView, PageHead, StatTile } from "@/components/day-site/ui";
import { loadGuide } from "@/lib/day-guide-server";
import { loadDaySite } from "@/lib/day-site";

export const revalidate = 300;
export const metadata: Metadata = { title: "Venue" };

export default async function DayVenuePage() {
  const [guide, site] = await Promise.all([loadGuide("venue"), loadDaySite()]);
  return (
    <div className="space-y-10">
      <PageHead kicker={guide.kicker} title={guide.title} />
      {site.venue || site.dateText ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
          {site.venue ? (
            <StatTile label="Where" value={<span className="text-2xl sm:text-3xl">{site.venue}</span>} tone="gold" />
          ) : null}
          {site.dateText ? <StatTile label="When" value={<span className="text-2xl sm:text-3xl">{site.dateText}</span>} /> : null}
        </div>
      ) : null}
      <div className="day-glass p-6 sm:p-10">
        <GuideView blocks={guide.blocks} />
      </div>
    </div>
  );
}
