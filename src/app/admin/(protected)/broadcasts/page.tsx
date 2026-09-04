import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { BROADCAST_LIST_KINDS, BROADCAST_LIST_KIND_LABELS } from "@/lib/broadcast";
import { createBroadcastList } from "./actions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

export const metadata: Metadata = {
  title: "Admin — Email Lists",
};

export default async function AdminBroadcastsPage() {
  const lists = await prisma.broadcastList.findMany({
    include: { _count: { select: { contacts: true, broadcasts: true } } },
    orderBy: [{ kind: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div>
      <AdminPageHeader
        title="Email Lists"
        subtitle="Group people into lists and send them a broadcast email. Confirmed and waiting lists can pull their contacts straight from registrations."
      />

      <Card className="mt-6">
        <h2 className="font-display font-bold text-ras-purple dark:text-white">New list</h2>
        <form action={createBroadcastList} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="text-ras-gray dark:text-white/70">List name</span>
            <input
              name="name"
              required
              placeholder="e.g. Confirmed teams 2026"
              className="mt-1 w-full rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)]"
            />
          </label>
          <label className="text-sm">
            <span className="text-ras-gray dark:text-white/70">Type</span>
            <select
              name="kind"
              defaultValue="CUSTOM"
              className="mt-1 w-full rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)]"
            >
              {BROADCAST_LIST_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {BROADCAST_LIST_KIND_LABELS[kind]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="text-ras-gray dark:text-white/70">Description (optional)</span>
            <input
              name="description"
              placeholder="What this list is for"
              className="mt-1 w-full rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)]"
            />
          </label>
          <div className="sm:col-span-2">
            <Button type="submit">Create list</Button>
          </div>
        </form>
      </Card>

      <div className="mt-6 space-y-4">
        {lists.length === 0 && (
          <p className="text-sm text-ras-gray dark:text-white/60">No lists yet — create your first one above.</p>
        )}

        {lists.map((list) => (
          <Card key={list.id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <Link
                  href={`/admin/broadcasts/${list.id}`}
                  className="font-display font-bold text-ras-purple hover:underline dark:text-white"
                >
                  {list.name}
                </Link>
                <p className="text-xs text-ras-gray dark:text-white/60">
                  {BROADCAST_LIST_KIND_LABELS[list.kind as keyof typeof BROADCAST_LIST_KIND_LABELS] ?? list.kind} ·{" "}
                  {list._count.contacts} contact{list._count.contacts === 1 ? "" : "s"} · {list._count.broadcasts}{" "}
                  broadcast{list._count.broadcasts === 1 ? "" : "s"} sent
                </p>
                {list.description && (
                  <p className="mt-1 text-sm text-ras-gray dark:text-white/70">{list.description}</p>
                )}
              </div>
              <Button asChild variant="ghost" className="px-3 py-1 text-xs">
                <Link href={`/admin/broadcasts/${list.id}`}>Open</Link>
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
