import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { BROADCAST_LIST_KIND_LABELS, KIND_IMPORT_STATUS, parseListKind } from "@/lib/broadcast";
import { parseButtons } from "@/lib/broadcast-compose";
import { formatBytes } from "@/lib/attachment";
import { deleteBroadcastList, removeContact } from "../actions";
import { lastUsedWrapper } from "../compose-actions";
import { AddContactsForm, ImportForm } from "../ListForms";
import { EmailComposer, type ComposerDraft } from "../EmailComposer";

export const metadata: Metadata = {
  title: "Admin | Email List",
};

export default async function BroadcastListPage({ params }: { params: { id: string } }) {
  const list = await prisma.broadcastList.findUnique({
    where: { id: params.id },
    include: { contacts: { orderBy: { addedAt: "asc" } } },
  });

  if (!list) notFound();

  /*
    Four queries rather than one nested include, because they answer four
    different questions and only the first is about this list: what is being
    written for it, what can be started from, what has been sent to it, and what
    wording the last email used.
  */
  const [draft, templates, history, defaults] = await Promise.all([
    // SENDING as well as DRAFT: reloading the page mid-send has to find that
    // email again rather than offering a blank composer beside a running send.
    prisma.broadcast.findFirst({
      where: { listId: list.id, status: { in: ["DRAFT", "SENDING"] } },
      orderBy: { updatedAt: "desc" },
      include: { attachments: { orderBy: { addedAt: "asc" } } },
    }),
    prisma.broadcast.findMany({
      where: { status: "TEMPLATE" },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    prisma.broadcast.findMany({
      where: { listId: list.id, status: "SENT" },
      orderBy: { sentAt: "desc" },
      take: 10,
      include: { attachments: { select: { id: true } } },
    }),
    lastUsedWrapper(),
  ]);

  const kind = parseListKind(list.kind);
  const importStatus = KIND_IMPORT_STATUS[kind];

  const composerDraft: ComposerDraft | null = draft
    ? {
        id: draft.id,
        subject: draft.subject,
        bodyHtml: draft.bodyHtml,
        greeting: draft.greeting,
        signOff: draft.signOff,
        footerNote: draft.footerNote,
        buttons: parseButtons(draft.buttons),
        cc: draft.cc,
        bcc: draft.bcc,
        attachments: draft.attachments.map((file) => ({
          id: file.id,
          filename: file.filename,
          size: file.size,
          contentType: file.contentType,
        })),
      }
    : null;

  return (
    <div>
      <Link
        href="/admin/broadcasts"
        className="text-xs text-ras-gray hover:underline dark:text-white/60"
      >
        ← All lists
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ras-purple dark:text-white">
            {list.name}
          </h1>
          <p className="mt-1 text-sm text-ras-gray dark:text-white/70">
            {BROADCAST_LIST_KIND_LABELS[kind]} · {list.contacts.length} contact
            {list.contacts.length === 1 ? "" : "s"}
          </p>
          {list.description ? (
            <p className="mt-1 text-sm text-ras-gray dark:text-white/70">{list.description}</p>
          ) : null}
        </div>
        <form action={deleteBroadcastList}>
          <input type="hidden" name="id" value={list.id} />
          <Button type="submit" variant="ghost" className="px-3 py-1 text-xs text-accent">
            Delete list
          </Button>
        </form>
      </div>

      {/* The composer first, because writing is what this page is for. */}
      <Card className="mt-6">
        <EmailComposer
          listId={list.id}
          listName={list.name}
          contactCount={list.contacts.length}
          draft={composerDraft}
          templates={templates.map((template) => ({
            id: template.id,
            name: template.name,
            subject: template.subject,
            bodyHtml: template.bodyHtml,
            greeting: template.greeting,
            signOff: template.signOff,
            footerNote: template.footerNote,
            buttons: parseButtons(template.buttons),
          }))}
          defaults={defaults}
        />
      </Card>

      <Card className="mt-6">
        <h2 className="font-display font-bold text-ras-purple dark:text-white">Add people</h2>
        <p className="mt-1 text-xs text-ras-gray dark:text-white/60">
          One per line (or comma separated). Either <code>name@example.com</code> or{" "}
          <code>Ada Lovelace &lt;ada@example.com&gt;</code>.
        </p>
        <AddContactsForm listId={list.id} />
        {importStatus ? <ImportForm listId={list.id} status={importStatus} /> : null}
      </Card>

      <Card className="mt-6">
        <h2 className="font-display font-bold text-ras-purple dark:text-white">
          Contacts{list.contacts.length > 0 ? ` (${list.contacts.length})` : ""}
        </h2>
        {list.contacts.length === 0 ? (
          <p className="mt-2 text-sm text-ras-gray dark:text-white/60">Nobody on this list yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-ras-gray/15">
            {list.contacts.map((contact) => (
              <li key={contact.id} className="flex items-center justify-between gap-4 py-2">
                <span className="text-sm text-ras-gray dark:text-white/80">
                  {contact.name ? `${contact.name}, ` : ""}
                  {contact.email}
                  {contact.source === "REGISTRATION" ? (
                    <span className="ml-2 text-xs text-ras-gray/70 dark:text-white/50">
                      (from registration)
                    </span>
                  ) : null}
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

      {history.length > 0 ? (
        <Card className="mt-6">
          <h2 className="font-display font-bold text-ras-purple dark:text-white">Already sent</h2>
          <ul className="mt-3 divide-y divide-ras-gray/15">
            {history.map((sent) => (
              <li key={sent.id} className="py-3">
                <p className="text-sm font-semibold text-ras-gray dark:text-white/85">
                  {sent.subject}
                </p>
                <p className="mt-0.5 text-xs text-ras-gray/85 dark:text-white/55">
                  {sent.sentAt.toLocaleString()} · {sent.sentCount} sent
                  {sent.failedCount > 0 ? ` · ${sent.failedCount} failed` : ""}
                  {sent.attachments.length > 0
                    ? ` · ${sent.attachments.length} attachment${sent.attachments.length === 1 ? "" : "s"}`
                    : ""}
                  {sent.cc ? ` · cc ${sent.cc}` : ""}
                </p>
                {/* Which addresses failed, not merely how many — a count nobody
                    can act on is not a report. */}
                {sent.failedEmails ? (
                  <p className="mt-1 text-xs text-accent">Did not reach: {sent.failedEmails}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {draft && draft.attachments.length > 0 ? (
        <p className="mt-4 text-xs text-ras-gray dark:text-white/50">
          Draft attachments hold {formatBytes(draft.attachments.reduce((n, f) => n + f.size, 0))} of
          storage until the email is sent or discarded.
        </p>
      ) : null}
    </div>
  );
}
