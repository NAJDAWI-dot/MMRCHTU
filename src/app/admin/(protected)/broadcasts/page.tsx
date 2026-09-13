import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { BROADCAST_LIST_KINDS, BROADCAST_LIST_KIND_LABELS } from "@/lib/broadcast";
import { createBroadcastList } from "./actions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

export const metadata: Metadata = {
  title: "Admin | Email Lists",
};

const FIELD =
  "mt-1 w-full rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)]";

export default async function AdminBroadcastsPage() {
  /*
    Two queries, not one per list. Prisma cannot select "the newest sent email
    per list" inside an include, and the alternative — an include per row — is a
    query per list on a page whose whole job is to show all of them. Emails are
    few enough to group in memory.
  */
  const [lists, emails] = await Promise.all([
    prisma.broadcastList.findMany({
      include: { _count: { select: { contacts: true } } },
      orderBy: [{ kind: "asc" }, { createdAt: "desc" }],
    }),
    prisma.broadcast.findMany({
      where: { status: { in: ["SENT", "DRAFT", "SENDING"] }, NOT: { listId: null } },
      orderBy: { updatedAt: "desc" },
      select: { listId: true, status: true, subject: true, sentAt: true, sentCount: true },
    }),
  ]);

  const sentByList = new Map<string, (typeof emails)[number]>();
  const openByList = new Map<string, (typeof emails)[number]>();
  for (const email of emails) {
    if (!email.listId) continue;
    const bucket = email.status === "SENT" ? sentByList : openByList;
    if (!bucket.has(email.listId)) bucket.set(email.listId, email);
  }

  return (
    <div>
      <AdminPageHeader
        title="Email Lists"
        subtitle="Group people into lists, then write and send them an email. Confirmed and waiting lists can pull their contacts straight from registrations."
      />

      {/*
        Collapsed unless there is nothing yet. Creating a list is done a handful
        of times a year; opening one to write an email is done every week, and
        this form was sitting above the lists on every visit. Same reasoning and
        the same shape as the configuration block on the payments page.
      */}
      <details className="mt-6" open={lists.length === 0}>
        <summary className="cursor-pointer rounded-lg px-1 py-2 font-display text-lg font-bold text-ras-purple hover:text-mood-plum dark:text-white dark:hover:text-white/80">
          New list
        </summary>
        <Card className="mt-2">
          <form action={createBroadcastList} className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="text-ras-gray dark:text-white/70">List name</span>
              <input name="name" required placeholder="e.g. Confirmed teams 2026" className={FIELD} />
            </label>
            <label className="text-sm">
              <span className="text-ras-gray dark:text-white/70">Type</span>
              <select name="kind" defaultValue="CUSTOM" className={FIELD}>
                {BROADCAST_LIST_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {BROADCAST_LIST_KIND_LABELS[kind]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="text-ras-gray dark:text-white/70">Description (optional)</span>
              <input name="description" placeholder="What this list is for" className={FIELD} />
            </label>
            <div className="sm:col-span-2">
              <Button type="submit">Create list</Button>
            </div>
          </form>
        </Card>
      </details>

      <div className="mt-6 space-y-4">
        {lists.length === 0 ? (
          <p className="text-sm text-ras-gray dark:text-white/60">
            No lists yet. Create your first one above.
          </p>
        ) : null}

        {lists.map((list) => {
          const lastSent = sentByList.get(list.id);
          const open = openByList.get(list.id);

          return (
            <Card key={list.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <Link
                    href={`/admin/broadcasts/${list.id}`}
                    className="font-display font-bold text-ras-purple hover:underline dark:text-white"
                  >
                    {list.name}
                  </Link>
                  <p className="text-xs text-ras-gray dark:text-white/60">
                    {BROADCAST_LIST_KIND_LABELS[
                      list.kind as keyof typeof BROADCAST_LIST_KIND_LABELS
                    ] ?? list.kind}{" "}
                    · {list._count.contacts} contact{list._count.contacts === 1 ? "" : "s"}
                    {lastSent
                      ? ` · last sent ${lastSent.sentAt.toLocaleDateString()} to ${lastSent.sentCount}`
                      : " · nothing sent yet"}
                  </p>
                  {list.description ? (
                    <p className="mt-1 text-sm text-ras-gray dark:text-white/70">
                      {list.description}
                    </p>
                  ) : null}
                  {/* An unfinished email is the thing somebody came back to this
                      page for, so it says so here rather than waiting to be
                      rediscovered inside the list. */}
                  {open ? (
                    <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-ras-purple/10 px-3 py-1 text-xs font-medium text-ras-purple dark:bg-white/10 dark:text-white">
                      {open.status === "SENDING" ? "Sending now" : "Draft in progress"}
                      {open.subject ? `: ${open.subject}` : ""}
                    </p>
                  ) : null}
                </div>
                <Button asChild variant="ghost" className="px-3 py-1 text-xs">
                  <Link href={`/admin/broadcasts/${list.id}`}>
                    {open ? "Continue" : "Write an email"}
                  </Link>
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
