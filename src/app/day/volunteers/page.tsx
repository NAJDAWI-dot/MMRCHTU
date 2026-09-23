import type { Metadata } from "next";
import { GuideView, PageHead, SectionTitle } from "@/components/day-site/ui";
import { loadGuide } from "@/lib/day-guide-server";
import { prisma } from "@/lib/prisma";

export const revalidate = 60;
export const metadata: Metadata = { title: "Volunteers" };

/** The volunteer briefing, and who is at which station. Phone numbers never appear here. */
export default async function DayVolunteersPage() {
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
    <div className="space-y-12">
      <PageHead
        kicker={guide.kicker}
        title={guide.title}
        lead={volunteers.length ? `${volunteers.length} people are helping today. Thank you.` : undefined}
      />
      {stations.size ? (
        <section className="space-y-5">
          <SectionTitle kicker="Who is where">Stations</SectionTitle>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...stations.entries()].map(([station, people]) => (
              <div key={station} className="day-glass p-5">
                <p className="font-display text-xl font-extrabold text-white">{station}</p>
                <ul className="mt-3 space-y-2">
                  {people.map((person) => (
                    <li key={person.id} className="flex items-baseline justify-between gap-3">
                      <span>
                        <span className="font-semibold text-white">{person.name}</span>
                        {person.role ? <span className="block text-sm text-[var(--day-muted)]">{person.role}</span> : null}
                      </span>
                      {person.shift ? (
                        <span className="shrink-0 font-mono text-xs text-[var(--day-gold)]">{person.shift}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <div className="day-glass p-6 sm:p-10">
        <GuideView blocks={guide.blocks} />
      </div>
    </div>
  );
}
