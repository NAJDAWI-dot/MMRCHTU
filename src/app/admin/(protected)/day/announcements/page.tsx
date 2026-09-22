import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card } from "@/components/ui/Card";
import { requireSection, rolesOf } from "@/lib/admin-access";
import { postedAgo, sortAnnouncements } from "@/lib/day-mode";
import { prisma } from "@/lib/prisma";
import { DeskTabs } from "../DeskTabs";
import { AddAnnouncementForm, EditAnnouncementForm } from "./AnnouncementForms";

export const metadata: Metadata = { title: "Admin | Announcements" };

/** Notices on the live page and in the ticker across the top of the day site. */
export default async function AnnouncementsDeskPage() {
  const admin = await requireSection("/admin/day/announcements");
  const rows = await prisma.dayAnnouncement.findMany({ orderBy: { createdAt: "desc" } });
  const announcements = sortAnnouncements(rows);
  const showing = rows.filter((row) => row.isPublished).length;
  const now = new Date();

  return (
    <div>
      <AdminPageHeader
        title="Announcements"
        subtitle={`${rows.length} announcement${rows.length === 1 ? "" : "s"}, ${showing} showing on the day site`}
      />
      <DeskTabs roles={rolesOf(admin)} current="/admin/day/announcements" />

      <Card className="mt-6">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ras-gray dark:text-white/70">
          Post an announcement
        </h2>
        <p className="mt-1 text-xs text-ras-gray dark:text-white/60">
          Newest first, pinned ones above the rest. Phones left open on the day site pick it up within a
          minute.
        </p>
        <AddAnnouncementForm />
      </Card>

      <div className="mt-6 space-y-4">
        {announcements.map((row) => (
          <Card key={row.id} className={row.isPinned ? "border-[#F2A900]/60" : ""}>
            <EditAnnouncementForm
              row={row}
              posted={`Posted ${postedAgo(row.createdAt, now)}${row.isPinned ? " · pinned" : ""}`}
            />
          </Card>
        ))}
      </div>
    </div>
  );
}
