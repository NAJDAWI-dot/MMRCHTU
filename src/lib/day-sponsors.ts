import "server-only";
import type { WallSponsor } from "@/components/day-site/SponsorWall";
import { prisma } from "@/lib/prisma";
import { parseLogoBackground } from "@/lib/sponsors";

/** The sponsors on the slide, in the desk's order, for the hall screen and the testing day screen. */
export async function loadSlideSponsors(): Promise<WallSponsor[]> {
  const rows = await prisma.sponsor.findMany({
    where: { isPublished: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, tier: true, logoUrl: true, logoBackground: true },
  });
  return rows.map((row) => ({ ...row, logoBackground: parseLogoBackground(row.logoBackground) }));
}
