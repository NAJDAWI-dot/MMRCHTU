import type { Metadata } from "next";
import { GuideView, PageHead, SectionTitle } from "@/components/day-site/ui";
import { loadGuide } from "@/lib/day-guide-server";
import { prisma } from "@/lib/prisma";

export const revalidate = 300;
export const metadata: Metadata = { title: "Organizers" };

/** The committee running the day, from the committee page data, and who to ask. */
export default async function DayOrganizersPage() {
  const [guide, members] = await Promise.all([
    loadGuide("organizers"),
    prisma.committeeMember.findMany({
      where: { isPublished: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, role: true, photoUrl: true, department: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="space-y-12">
      <PageHead kicker={guide.kicker} title={guide.title} />
      <div className="day-glass p-6 sm:p-10">
        <GuideView blocks={guide.blocks} />
      </div>
      {members.length ? (
        <section className="space-y-5">
          <SectionTitle kicker="IEEE RAS HTU Student Chapter">The organizing committee</SectionTitle>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {members.map((member) => (
              <li key={member.id} className="day-glass flex items-center gap-4 p-4">
                {member.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- small committee photos from the blob store, already sized on upload
                  <img src={member.photoUrl} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-white/10" />
                ) : (
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[var(--day-violet)]/40 to-[var(--day-rose)]/30 font-display text-lg font-extrabold text-white">
                    {member.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-white">{member.name}</span>
                  <span className="block truncate text-sm text-[var(--day-muted)]">
                    {[member.role, member.department?.name].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
