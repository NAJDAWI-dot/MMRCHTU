import type { Metadata } from "next";
import { DayIcon } from "@/components/day-site/icons";
import { GuideView, PageHead, SectionTitle } from "@/components/day-site/ui";
import { loadGuide } from "@/lib/day-guide-server";
import { prisma } from "@/lib/prisma";
import { requireDayViewer } from "@/lib/day-access";

export const revalidate = 60;
export const metadata: Metadata = { title: "Volunteers" };

/** The volunteer briefing, and who is at which station. Phone numbers never appear here. */
export default async function DayVolunteersPage() {
  await requireDayViewer();
  const [guide, volunteers] = await Promise.all([
    loadGuide("volunteers"),
    prisma.volunteer.findMany({
      where: { isPublished: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, role: true, station: true, shift: true },
    }),
  ]);

  const stations = new Map<string, typeof volunteers>();
  for (const person of volunteers) {
    const key = person.station || "Around the venue";
    stations.set(key, [...(stations.get(key) ?? []), person]);
  }

  return (
    <div className="space-y-14">
      <PageHead
        kicker={guide.kicker}
        title={guide.title}
        lead={volunteers.length ? `${volunteers.length} people are helping today. Thank you.` : undefined}
      />
      {stations.size ? (
        <section className="space-y-6">
          <SectionTitle kicker="Who is where">Stations</SectionTitle>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...stations.entries()].map(([station, people], index) => (
              <div key={station} className="day-card day-posts" data-reveal style={{ ["--i" as string]: index % 6 }}>
                <div className="flex items-center gap-3 border-b-2 border-day-line/85 px-5 py-4">
                  <DayIcon name="pin" className="h-5 w-5 shrink-0 text-day-crimson" />
                  <p className="day-display text-xl text-day-ink">{station}</p>
                  <span className="day-num ml-auto text-sm text-day-faint">{people.length}</span>
                </div>
                <ul className="divide-y divide-day-line/[0.08]">
                  {people.map((person) => (
                    <li key={person.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-day-ink">{person.name}</span>
                        {person.role ? <span className="block truncate text-sm text-day-muted">{person.role}</span> : null}
                      </span>
                      {person.shift ? <span className="day-chip day-num shrink-0 bg-day-gold/15 text-day-gold">{person.shift}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <GuideView blocks={guide.blocks} />
    </div>
  );
}
