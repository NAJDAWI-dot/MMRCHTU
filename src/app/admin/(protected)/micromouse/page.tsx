import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card } from "@/components/ui/Card";
import { prisma } from "@/lib/prisma";
import { AddReferenceForm, EditReferenceForm } from "./ReferenceForms";

export const metadata: Metadata = {
  title: "Admin | Micro Mouse",
};

/**
 * The reading list at the foot of the build guide.
 *
 * Deliberately the same shape as the Schedule screen: one card to add, one
 * card per row to edit, Delete underneath. An admin who has used any other
 * list here already knows how this one works.
 *
 * Sort order is a number rather than up and down arrows, as it is everywhere
 * else in this app. Rows are grouped by kind on the public page, so an arrow
 * would mean something different depending on which group a row sits in, and
 * gaps of ten leave room to slot a link between two others without touching
 * every row.
 */
export default async function AdminMicromousePage() {
  const references = await prisma.micromouseReference.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const published = references.filter((reference) => reference.isPublished).length;
  const nextSortOrder = references.length
    ? Math.max(...references.map((reference) => reference.sortOrder)) + 10
    : 10;

  return (
    <div>
      <AdminPageHeader
        title="Micro Mouse"
        subtitle={
          <>
            {references.length} reference{references.length === 1 ? "" : "s"}, {published} showing
            on{" "}
            <Link
              href="/micromouse#references"
              className="font-semibold text-accent hover:underline"
            >
              the build guide
            </Link>
            .
          </>
        }
      />

      <Card className="mt-6">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ras-gray dark:text-white/70">
          Add a reference
        </h2>
        <p className="mt-1 text-xs text-ras-gray dark:text-white/60">
          Paste any YouTube link and the card picks up the video&apos;s own picture. Playlists are
          the links with <code>list=</code> in them. Anything else is a website.
        </p>
        <AddReferenceForm nextSortOrder={nextSortOrder} />
      </Card>

      {references.length === 0 ? (
        <Card className="mt-6">
          <p className="text-sm text-ras-gray dark:text-white/70">
            No references yet. The section at the foot of the guide stays hidden until there is at
            least one.
          </p>
        </Card>
      ) : null}

      <div className="mt-6 space-y-4">
        {references.map((reference) => (
          <Card key={reference.id}>
            <EditReferenceForm reference={reference} />
          </Card>
        ))}
      </div>
    </div>
  );
}
