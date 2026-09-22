import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card } from "@/components/ui/Card";
import { LiveDot } from "@/components/day/LiveDot";
import { requireSection, rolesOf } from "@/lib/admin-access";
import { DAY_AUDIENCE_LABELS, parseAudience, parseViewerIds } from "@/lib/day-access";
import { DAY_MODE_HIDDEN_PAGES } from "@/lib/day-mode";
import { getCompetitionDayConfig } from "@/lib/site-config";
import { prisma } from "@/lib/prisma";
import { DeskTabs } from "../day/DeskTabs";
import { AudienceForm } from "./DayModeForms";

export const metadata: Metadata = {
  title: "Admin | Day site access",
};

/**
 * Who can open the competition day site. Master only.
 *
 * The day site lives at /day. It is private until someone here says otherwise,
 * and going public is what turns the homepage over to it and hides Register
 * and Rules.
 */
export default async function DaySiteAccessPage() {
  const admin = await requireSection("/admin/day-mode");
  const [config, admins] = await Promise.all([
    getCompetitionDayConfig(),
    prisma.adminUser.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, username: true } }),
  ]);
  const audience = parseAudience(config.dayAudience);
  const viewerIds = parseViewerIds(config.dayViewerIds);
  const viewers = admins.filter((row) => viewerIds.includes(row.id)).map((row) => row.username);
  const isPublic = audience === "PUBLIC";

  return (
    <div>
      <AdminPageHeader title="Day site access" subtitle="Who can open the competition day site at /day." />
      <DeskTabs roles={rolesOf(admin)} current="/admin/day-mode" />

      <Card className={`mt-6 ${isPublic ? "border-ras-crimson/40 dark:border-mood-rose/40" : ""}`}>
        <p className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          {isPublic ? <LiveDot /> : null}
          {DAY_AUDIENCE_LABELS[audience]}
        </p>
        <p className="mt-2 max-w-2xl text-sm text-ras-gray dark:text-white/70">
          {audience === "PUBLIC"
            ? `Everyone who opens mmrchtu.tech gets the day site. ${DAY_MODE_HIDDEN_PAGES.join(" and ")} are hidden.`
            : audience === "STAFF"
              ? "Any signed-in admin can open it. Visitors still get the normal site."
              : viewers.length
                ? `Only ${viewers.join(", ")} can open it. Visitors still get the normal site.`
                : "Nobody has been named yet, so only Master admins can open it."}
        </p>
        <p className="mt-3 text-sm">
          <Link href="/day" className="font-semibold text-accent hover:underline">
            Open the day site →
          </Link>
        </p>
        <p className="mt-2 text-xs text-ras-gray dark:text-white/55">
          Signed in before this was set up and seeing “not found”? Log out and back in once.
        </p>
      </Card>

      <Card className="mt-6">
        <AudienceForm
          audience={audience}
          viewerIds={viewerIds}
          admins={admins.map((row) => ({ ...row, isMe: row.id === admin.id }))}
        />
      </Card>
    </div>
  );
}
