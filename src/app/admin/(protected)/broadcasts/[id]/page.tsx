import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { BROADCAST_LIST_KIND_LABELS, KIND_IMPORT_STATUS, parseListKind } from "@/lib/broadcast";
import { deleteBroadcastList, removeContact } from "../actions";
import { AddContactsForm, ImportForm, SendBroadcastForm } from "../ListForms";

export const metadata: Metadata = {
  title: "Admin — Email List",
};

export default async function BroadcastListPage({ params }: { params: { id: string } }) {
  const list = await prisma.broadcastList.findUnique({
    where: { id: params.id },
    include: {
      contacts: { orderBy: { addedAt: "asc" } },
      broadcasts: { orderBy: { sentAt: "desc" }, take: 10 },
    },
  });

  if (!list) notFound();

  const kind = parseListKind(list.kind);
  const importStatus = KIND_IMPORT_STATUS[kind];

  return (
    <div>
      <Link href="/admin/broadcasts" className="text-xs text-ras-gray hover:underline dark:text-white/60">
        ← All lists
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ras-purple dark:text-white">{list.name}</h1>
          <p className="mt-1 text-sm text-ras-gray dark:text-white/70">
            {BROADCAST_LIST_KIND_LABELS[kind]} · {list.contacts.length} contact
            {list.contacts.length === 1 ? "" : "s"}
          </p>
          {list.description && <p className="mt-1 text-sm text-ras-gray dark:text-white/70">{list.description}</p>}
        </div>
        <form action={deleteBroadcastList}>
          <input type="hidden" name="id" value={list.id} />
          <Button type="submit" variant="ghost" className="px-3 py-1 text-xs text-accent">
            Delete list
          </Button>
        </form>
      </div>

      <Card className="mt-6">
        <h2 className="font-display font-bold text-ras-purple dark:text-white">Add people</h2>
        <p className="mt-1 text-xs text-ras-gray dark:text-white/60">
          One per line (or comma separated). Either <code>name@example.com</code> or{" "}
          <code>Ada Lovelace &lt;ada@example.com&gt;</code>.
        </p>
        <AddContactsForm listId={list.id} />
        {importStatus && <ImportForm listId={list.id} status={importStatus} />}
      </Card>

      <Card className="mt-6">
        <h2 className="font-display font-bold text-ras-purple dark:text-white">Send a broadcast</h2>
        <p className="mt-1 text-xs text-ras-gray dark:text-white/60">
          Each person gets their own copy — recipients never see each other&apos;s addresses.
        </p>
        <SendBroadcastForm listId={list.id} contactCount={list.contacts.length} />
      </Card>

      <Card className="mt-6">
        <h2 className="font-display font-bold text-ras-purple dark:text-white">Contacts</h2>
        {list.contacts.length === 0 ? (
          <p className="mt-2 text-sm text-ras-gray dark:text-white/60">Nobody on this list yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-ras-gray/15">
            {list.contacts.map((contact) => (
              <li key={contact.id} className="flex items-center justify-between gap-4 py-2">
                <span className="text-sm text-ras-gray dark:text-white/80">
                  {contact.name ? `${contact.name} — ` : ""}
                  {contact.email}
                  {contact.source === "REGISTRATION" && (
                    <span className="ml-2 text-xs text-ras-gray/70 dark:text-white/50">(from registration)</span>
                  )}
                </span>
                <form action={removeContact}>
                  <input type="hidden" name="id" value={contact.id} />
                  <input type="hidden" name="listId" value={list.id} />
                  <Button type="submit" variant="ghost" className="px-2 py-1 text-xs">
                    Remove
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {list.broadcasts.length > 0 && (
        <Card className="mt-6">
          <h2 className="font-display font-bold text-ras-purple dark:text-white">Recent broadcasts</h2>
          <ul className="mt-3 space-y-2">
            {list.broadcasts.map((broadcast) => (
              <li key={broadcast.id} className="text-sm text-ras-gray dark:text-white/80">
                <strong>{broadcast.subject}</strong>
                <span className="ml-2 text-xs text-ras-gray/80 dark:text-white/50">
                  {broadcast.sentAt.toLocaleString()} · {broadcast.sentCount} sent
                  {broadcast.failedCount > 0 ? ` · ${broadcast.failedCount} failed` : ""}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
