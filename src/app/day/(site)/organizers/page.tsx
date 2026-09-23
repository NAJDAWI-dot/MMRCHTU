import type { Metadata } from "next";
import { ChapterLogo } from "@/components/day-site/DayNav";
import { GuideView, PageHead, SectionTitle } from "@/components/day-site/ui";
import { loadGuide } from "@/lib/day-guide-server";
import { prisma } from "@/lib/prisma";
import { requireDayViewer } from "@/lib/day-access";

export const revalidate = 300;
export const metadata: Metadata = { title: "Organizers" };

/** The committee running the day, from the committee page data, and who to ask. */
export default async function DayOrganizersPage() {
  await requireDayViewer();
  const [guide, members] = await Promise.all([
    loadGuide("organizers"),
    prisma.committeeMember.findMany({
      where: { isPublished: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, role: true, photoUrl: true, department: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="space-y-14">
      <PageHead kicker={guide.kicker} title={guide.title}>
        <ChapterLogo className="h-24 w-24" />
      </PageHead>
      <div className="day-card p-6 sm:p-10">
        <GuideView blocks={guide.blocks} />
      </div>
      {members.length ? (
        <section className="space-y-6">
          <SectionTitle kicker="IEEE RAS HTU Student Chapter">The organizing committee</SectionTitle>
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {members.map((member, index) => (
              <li key={member.id} className="day-card flex flex-col items-center p-5 text-center" data-reveal style={{ ["--i" as string]: index % 8 }}>
                {member.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- small committee photos from the blob store, already sized on upload
                  <img src={member.photoUrl} alt="" className="h-20 w-20 rounded-full object-cover ring-4 ring-day-sunk" />
                ) : (
                  <span className="day-display grid h-20 w-20 place-items-center rounded-full bg-day-plum/10 text-2xl text-day-plum">
                    {member.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="mt-4 block font-semibold text-day-ink">{member.name}</span>
                <span className="mt-1 block text-sm text-day-muted">{[member.role, member.department?.name].filter(Boolean).join(" · ")}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
