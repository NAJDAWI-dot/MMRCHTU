import type { Metadata } from "next";
import { requireSection } from "@/lib/admin-access";
import { DAY_AUDIENCE_LABELS, parseAudience, parseViewerIds } from "@/lib/day-audience";
import { DAY_MODE_HIDDEN_PAGES } from "@/lib/day-mode";
import { getCompetitionDayConfig } from "@/lib/site-config";
import { prisma } from "@/lib/prisma";
import { DeskHead } from "../DeskKit";
import { AudienceForm } from "./DayModeForms";
import { openDaySite } from "@/lib/day-links";

export const metadata: Metadata = { title: "Access" };

/**
 * Who can open the competition day site. Master only.
 *
 * The day site lives at /day. It is private until someone here says otherwise,
 * and going public is what turns the homepage over to it and hides Register
 * and Rules.
 */
export default async function DaySiteAccessPage() {
  const admin = await requireSection("/day/hq/access");
  const [config, admins] = await Promise.all([
    getCompetitionDayConfig(),
    prisma.adminUser.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, username: true } }),
  ]);
  const audience = parseAudience(config.dayAudience);
  const viewerIds = parseViewerIds(config.dayViewerIds);
  const viewers = admins.filter((row) => viewerIds.includes(row.id)).map((row) => row.username);
  const isPublic = audience === "PUBLIC";

  return (
    <div className="space-y-8">
      <DeskHead icon="lock" title="Access" lead="Who can open the competition day site, and when it takes over mmrchtu.tech." />

      <section className={`day-card p-5 sm:p-6 ${isPublic ? "ring-2 ring-day-live/40" : ""}`}>
        <p className={`day-kicker flex items-center gap-2 ${isPublic ? "text-day-live" : ""}`}>
          {isPublic ? <span className="day-live-dot" aria-hidden="true" /> : null}
          {DAY_AUDIENCE_LABELS[audience]}
        </p>
        <p className="mt-3 max-w-2xl text-day-ink">
          {audience === "PUBLIC"
            ? `Everyone who opens mmrchtu.tech gets the day site. ${DAY_MODE_HIDDEN_PAGES.join(" and ")} are hidden.`
            : audience === "STAFF"
              ? "Any signed-in admin can open it. Visitors still get the normal site."
              : viewers.length
                ? `Only ${viewers.join(", ")} can open it. Visitors still get the normal site.`
                : "Nobody has been named yet, so only Master admins can open it."}
        </p>
        <p className="mt-4">
          <a href={openDaySite("/day")} className="day-btn day-btn-soft day-btn-sm">
            Open the day site
          </a>
        </p>
        <p className="mt-3 text-xs text-day-faint">
          Signed in before this was set up and seeing “not found”? Sign out and back in once.
        </p>
        <p className="mt-1 text-xs text-day-faint">
          While it is open to everyone, /admin opens Day HQ; the classic admin is a link away in the header.
        </p>
      </section>

      <section className="day-card p-5 sm:p-6">
        <AudienceForm
          audience={audience}
          viewerIds={viewerIds}
          admins={admins.map((row) => ({ ...row, isMe: row.id === admin.id }))}
        />
      </section>
    </div>
  );
}
