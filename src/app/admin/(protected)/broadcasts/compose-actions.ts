"use server";

/**
 * Everything the composer can do to one email.
 *
 * Separate from actions.ts, which manages lists and the people on them. That
 * file answers "who gets email"; this one answers "what is in it", and they are
 * touched at different times for different reasons.
 *
 * Every action here takes the whole form and returns the same result shape,
 * rather than each one taking the two or three fields it happens to need. The
 * composer is a single screen of state that can be saved, tested, attached to
 * or sent at any moment, and an action that read only its own fields would
 * quietly drop whatever the admin had typed since the last save.
 */

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendBroadcast, sendBroadcastTest, type BroadcastMessage } from "@/lib/email";
import { isValidEmail } from "@/lib/broadcast";
import {
  DEFAULT_FOOTER_NOTE,
  DEFAULT_GREETING,
  DEFAULT_SIGN_OFF,
  MAX_BUTTONS,
  hasComposeErrors,
  normaliseCompose,
  parseAddressList,
  parseButtons,
  serialiseButtons,
  validateCompose,
  type ComposeErrors,
  type EmailButton,
} from "@/lib/broadcast-compose";
import { renderRichText } from "@/lib/rich-text";
import {
  ATTACHMENT_SNIFF_BYTES,
  ATTACHMENT_TYPE_SUMMARY,
  attachmentFilename,
  attachmentStorageKey,
  checkAttachment,
  sniffAttachmentType,
} from "@/lib/attachment";
import { StorageNotConfiguredError, removePhoto, storePhoto } from "@/lib/photo-storage";
import { SEND_BATCH_SIZE } from "./state";

export interface ComposerResult {
  ok: boolean;
  message: string | null;
  /** Set once the email exists as a row, so the client can attach to it. */
  draftId?: string;
  errors?: ComposeErrors;
}

function fail(message: string, errors?: ComposeErrors): ComposerResult {
  return { ok: false, message, errors };
}

/* -------------------------------------------------------------------------- */
/* Reading the form                                                            */
/* -------------------------------------------------------------------------- */

function readButtons(formData: FormData): EmailButton[] {
  const buttons: EmailButton[] = [];
  for (let index = 0; index < MAX_BUTTONS; index += 1) {
    const label = String(formData.get(`buttonLabel${index}`) ?? "");
    const href = String(formData.get(`buttonHref${index}`) ?? "");
    if (label.trim() || href.trim()) buttons.push({ label, href });
  }
  return buttons;
}

interface ComposerForm {
  draftId: string;
  listId: string;
  templateName: string;
  compose: ReturnType<typeof normaliseCompose>;
  raw: {
    subject: string;
    bodyHtml: string;
    greeting: string;
    signOff: string;
    footerNote: string;
    buttons: EmailButton[];
    cc: string;
    bcc: string;
  };
}

function readForm(formData: FormData): ComposerForm {
  const raw = {
    subject: String(formData.get("subject") ?? ""),
    bodyHtml: String(formData.get("bodyHtml") ?? ""),
    greeting: String(formData.get("greeting") ?? ""),
    signOff: String(formData.get("signOff") ?? ""),
    footerNote: String(formData.get("footerNote") ?? ""),
    buttons: readButtons(formData),
    cc: String(formData.get("cc") ?? ""),
    bcc: String(formData.get("bcc") ?? ""),
  };
  return {
    draftId: String(formData.get("draftId") ?? ""),
    listId: String(formData.get("listId") ?? ""),
    templateName: String(formData.get("templateName") ?? "").trim().slice(0, 80),
    compose: normaliseCompose(raw),
    raw,
  };
}

/**
 * The columns an email is written to, whatever is being done with it.
 *
 * `body` is the plain-text rendition and is written on every save, not only on
 * send: it is what the history list shows, what a text-only mail client
 * receives, and the only readable form left if the HTML is ever unparseable.
 */
function columnsFor(form: ComposerForm, status: "DRAFT" | "SENT" | "TEMPLATE") {
  const { compose } = form;
  return {
    subject: compose.subject,
    body: renderRichText(compose.bodyHtml).text,
    bodyHtml: compose.bodyHtml,
    greeting: compose.greeting,
    signOff: compose.signOff,
    footerNote: compose.footerNote,
    buttons: serialiseButtons(compose.buttons),
    cc: compose.cc.join(", "),
    bcc: compose.bcc.join(", "),
    status,
  };
}

/**
 * The row this email lives in, created if it does not have one yet.
 *
 * A draft is written the first time anything needs to persist — an attachment,
 * a save, a send — rather than when the page opens, so opening the composer and
 * walking away leaves nothing behind.
 */
async function upsertDraft(form: ComposerForm): Promise<string> {
  const columns = columnsFor(form, "DRAFT");

  if (form.draftId) {
    const existing = await prisma.broadcast.findUnique({
      where: { id: form.draftId },
      select: { id: true, status: true },
    });
    // A sent email is a record of what went out and is never rewritten. If the
    // client is still holding the id of one, it starts a new draft instead.
    if (existing && existing.status !== "SENT") {
      await prisma.broadcast.update({ where: { id: existing.id }, data: columns });
      return existing.id;
    }
  }

  const created = await prisma.broadcast.create({
    data: { ...columns, listId: form.listId || null },
  });
  return created.id;
}

function refresh(listId: string): void {
  if (listId) revalidatePath(`/admin/broadcasts/${listId}`);
  revalidatePath("/admin/broadcasts");
}

/* -------------------------------------------------------------------------- */
/* Saving                                                                      */
/* -------------------------------------------------------------------------- */

export async function saveDraft(formData: FormData): Promise<ComposerResult> {
  await requireAdmin();
  const form = readForm(formData);

  // Deliberately not validated. A draft is by definition half-written, and an
  // editor that refuses to save until the email is finished is one that loses
  // work every time somebody is interrupted.
  const draftId = await upsertDraft(form);
  refresh(form.listId);

  return {
    ok: true,
    message: `Draft saved${form.compose.subject ? ` — "${form.compose.subject}"` : ""}.`,
    draftId,
  };
}

export async function saveAsTemplate(formData: FormData): Promise<ComposerResult> {
  await requireAdmin();
  const form = readForm(formData);

  if (!form.templateName) {
    return fail("Give the template a name so you can find it again.");
  }

  // A template is a copy, not a move: saving one must not take the email you
  // are in the middle of writing away from the list you were writing it for.
  const created = await prisma.broadcast.create({
    data: {
      ...columnsFor(form, "TEMPLATE"),
      name: form.templateName,
      listId: null,
    },
  });

  refresh(form.listId);
  return { ok: true, message: `Saved "${form.templateName}" to start from next time.`, draftId: created.id };
}

export async function discardDraft(formData: FormData): Promise<ComposerResult> {
  await requireAdmin();
  const id = String(formData.get("draftId") ?? "");
  const listId = String(formData.get("listId") ?? "");
  if (!id) return { ok: true, message: null };

  const draft = await prisma.broadcast.findUnique({
    where: { id },
    select: { status: true, attachments: { select: { key: true } } },
  });
  if (!draft) return { ok: true, message: null };
  if (draft.status === "SENT") return fail("That email has already been sent — it cannot be discarded.");

  // The rows cascade; the files in the blob store do not, so they go by hand.
  for (const attachment of draft.attachments) {
    await removePhoto(attachment.key);
  }
  await prisma.broadcast.delete({ where: { id } });

  refresh(listId);
  return { ok: true, message: "Draft discarded." };
}

/* -------------------------------------------------------------------------- */
/* Attachments                                                                 */
/* -------------------------------------------------------------------------- */

export async function attachFile(formData: FormData): Promise<ComposerResult> {
  await requireAdmin();
  const form = readForm(formData);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Choose a file to attach.");

  // The draft has to exist before a file can belong to it, and this is often
  // the first thing an admin does — so attaching is one of the moments that
  // brings the row into being.
  const draftId = await upsertDraft(form);

  const existing = await prisma.broadcastAttachment.findMany({
    where: { broadcastId: draftId },
    select: { size: true },
  });
  const problem = checkAttachment(
    { name: file.name, type: file.type, size: file.size },
    {
      alreadyAttached: existing.length,
      bytesAttached: existing.reduce((total, item) => total + item.size, 0),
    },
  );
  if (problem) return { ...fail(problem), draftId };

  // The declared type got it this far; the bytes decide whether it is stored.
  const head = new Uint8Array(await file.slice(0, ATTACHMENT_SNIFF_BYTES).arrayBuffer());
  const type = sniffAttachmentType(head, file.type);
  if (!type) {
    return {
      ...fail(`"${file.name}" is not what it says it is. Allowed: ${ATTACHMENT_TYPE_SUMMARY}.`),
      draftId,
    };
  }

  const key = attachmentStorageKey(type, randomUUID().replace(/-/g, ""));
  let stored;
  try {
    stored = await storePhoto(key, file, type);
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) return { ...fail(error.message), draftId };
    throw error;
  }

  const filename = attachmentFilename(file.name, type);
  try {
    await prisma.broadcastAttachment.create({
      data: {
        broadcastId: draftId,
        filename,
        url: stored.url,
        key: stored.key,
        contentType: type,
        size: file.size,
      },
    });
  } catch (error) {
    // The upload already happened, so a failure here would otherwise leave a
    // file in the store with nothing pointing at it.
    await removePhoto(stored.key);
    throw error;
  }

  refresh(form.listId);
  return { ok: true, message: `Attached ${filename}.`, draftId };
}

export async function detachFile(formData: FormData): Promise<ComposerResult> {
  await requireAdmin();
  const id = String(formData.get("attachmentId") ?? "");
  const listId = String(formData.get("listId") ?? "");
  if (!id) return fail("Missing attachment.");

  const attachment = await prisma.broadcastAttachment.findUnique({
    where: { id },
    select: { key: true, filename: true, broadcast: { select: { status: true } } },
  });
  if (!attachment) return { ok: true, message: null };
  if (attachment.broadcast.status === "SENT") {
    return fail("That email has already been sent — its attachments are part of the record.");
  }

  await prisma.broadcastAttachment.delete({ where: { id } });
  await removePhoto(attachment.key);

  refresh(listId);
  return { ok: true, message: `Removed ${attachment.filename}.` };
}

/* -------------------------------------------------------------------------- */
/* Sending                                                                     */
/* -------------------------------------------------------------------------- */

async function messageFor(form: ComposerForm, draftId: string): Promise<BroadcastMessage> {
  const attachments = await prisma.broadcastAttachment.findMany({
    where: { broadcastId: draftId },
    orderBy: { addedAt: "asc" },
    select: { filename: true, url: true },
  });
  return {
    subject: form.compose.subject,
    bodyHtml: form.compose.bodyHtml,
    greeting: form.compose.greeting,
    signOff: form.compose.signOff,
    footerNote: form.compose.footerNote,
    buttons: form.compose.buttons,
    attachments,
  };
}

export async function sendTest(formData: FormData): Promise<ComposerResult> {
  await requireAdmin();
  const form = readForm(formData);
  const to = String(formData.get("testEmail") ?? "").trim().toLowerCase();

  if (!isValidEmail(to)) return fail("Enter the address to send the test to.");
  if (!form.compose.subject) return fail("Give the email a subject first — a test of a blank one proves nothing.");
  if (!renderRichText(form.compose.bodyHtml).hasContent) {
    return fail("Write the message first — a test of an empty email proves nothing.");
  }

  // Saved before it is sent, so the test goes out with whatever the attachments
  // actually are rather than with whatever they were at the last save.
  const draftId = await upsertDraft(form);
  const ok = await sendBroadcastTest(to, await messageFor(form, draftId));

  refresh(form.listId);
  return ok
    ? { ok: true, message: `Test sent to ${to}. It is the same email the list would get.`, draftId }
    : { ...fail(`Could not send the test to ${to}. Check the mail settings and try again.`), draftId };
}

export interface SendProgress extends ComposerResult {
  total: number;
  sent: number;
  failed: number;
  done: boolean;
}

function progress(
  partial: Partial<SendProgress> & { ok: boolean; message: string | null },
): SendProgress {
  return { total: 0, sent: 0, failed: 0, done: false, ...partial };
}

interface FrozenRecipient {
  email: string;
  name: string;
}

function parseRecipients(raw: string): FrozenRecipient[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const email = String((entry as { email?: unknown }).email ?? "").trim();
      if (!email) return [];
      return [{ email, name: String((entry as { name?: unknown }).name ?? "") }];
    });
  } catch {
    return [];
  }
}

/**
 * The email as stored, not as the browser currently has it.
 *
 * Every batch after the first reads from here, so editing the composer while a
 * send is running cannot change what the rest of the list receives. Half a list
 * getting one email and half another is the exact failure this prevents.
 */
async function messageFromRow(row: {
  id: string;
  subject: string;
  bodyHtml: string;
  greeting: string;
  signOff: string;
  footerNote: string;
  buttons: string;
}): Promise<BroadcastMessage> {
  const attachments = await prisma.broadcastAttachment.findMany({
    where: { broadcastId: row.id },
    orderBy: { addedAt: "asc" },
    select: { filename: true, url: true },
  });
  return {
    subject: row.subject,
    bodyHtml: row.bodyHtml,
    greeting: row.greeting,
    signOff: row.signOff,
    footerNote: row.footerNote,
    buttons: parseButtons(row.buttons),
    attachments,
  };
}

/**
 * Freezes the recipient list and marks the email as sending.
 *
 * Nothing is actually sent here. The work is done by sendNextBatch, called
 * repeatedly by the browser, so that a list of any size is a series of short
 * requests rather than one long one that a serverless platform will cut off
 * partway through with no record of how far it got.
 */
export async function beginSend(formData: FormData): Promise<SendProgress> {
  await requireAdmin();
  const form = readForm(formData);

  if (!form.listId) return progress({ ...fail("This email is not attached to a list.") });

  const contacts = await prisma.broadcastContact.findMany({
    where: { listId: form.listId },
    orderBy: [{ addedAt: "asc" }, { id: "asc" }],
    select: { email: true, name: true },
  });

  const errors = validateCompose(form.raw, { contactCount: contacts.length });
  if (hasComposeErrors(errors)) {
    return progress({
      ok: false,
      message: "This email is not ready to send — see the fields marked below.",
      errors,
    });
  }

  const draftId = await upsertDraft(form);
  await prisma.broadcast.update({
    where: { id: draftId },
    data: {
      status: "SENDING",
      recipients: JSON.stringify(contacts.map((c) => ({ email: c.email, name: c.name }))),
      sentCount: 0,
      failedCount: 0,
      failedEmails: "",
      sentAt: new Date(),
    },
  });

  refresh(form.listId);
  return progress({
    ok: true,
    message: null,
    draftId,
    total: contacts.length,
    done: false,
  });
}

/**
 * Sends the next few, and finishes the job when there are none left.
 *
 * The position in the list is `sentCount + failedCount` — how many have been
 * dealt with, whatever the outcome. Counters are written after each batch, so a
 * request that dies mid-batch loses at most that batch: those ten are sent
 * again when it resumes. Ten possible duplicates is the price of never losing
 * the other hundred and ten, and it is the right way round.
 */
export async function sendNextBatch(formData: FormData): Promise<SendProgress> {
  await requireAdmin();
  const draftId = String(formData.get("draftId") ?? "");
  const listId = String(formData.get("listId") ?? "");
  if (!draftId) return progress({ ...fail("Nothing is being sent.") });

  const row = await prisma.broadcast.findUnique({ where: { id: draftId } });
  if (!row) return progress({ ...fail("That email no longer exists."), done: true });

  const recipients = parseRecipients(row.recipients);
  const total = recipients.length;

  if (row.status !== "SENDING") {
    // Already finished — a second tab, or a page reloaded after the last batch.
    return progress({
      ok: true,
      message: null,
      draftId,
      total,
      sent: row.sentCount,
      failed: row.failedCount,
      done: true,
    });
  }

  const offset = row.sentCount + row.failedCount;
  const batch = recipients.slice(offset, offset + SEND_BATCH_SIZE);
  const message = await messageFromRow(row);

  let sent = row.sentCount;
  let failed = row.failedCount;
  let failedEmails = row.failedEmails;

  if (batch.length > 0) {
    // No cc or bcc here: those get one copy for the whole send, not one per
    // batch, and that copy goes out below once everyone else has theirs.
    const result = await sendBroadcast(batch, message, { cc: [], bcc: [] });
    sent += result.sent;
    failed += result.failed;
    failedEmails = [failedEmails, ...result.failedEmails].filter(Boolean).join(", ");
    await prisma.broadcast.update({
      where: { id: draftId },
      data: { sentCount: sent, failedCount: failed, failedEmails },
    });
  }

  const done = sent + failed >= total;
  if (!done) {
    return progress({ ok: true, message: null, draftId, total, sent, failed, done: false });
  }

  const cc = parseAddressList(row.cc, "Cc").addresses;
  const bcc = parseAddressList(row.bcc, "Bcc").addresses;
  let copySent = true;
  if (cc.length + bcc.length > 0) {
    const copy = await sendBroadcast([], message, { cc, bcc });
    copySent = copy.copySent;
  }

  await prisma.broadcast.update({
    where: { id: draftId },
    data: { status: "SENT", sentAt: new Date() },
  });
  refresh(listId);

  const parts: string[] = [];
  parts.push(
    failed > 0
      ? `Sent to ${sent} of ${total}. Failed: ${failedEmails}`
      : `Sent "${row.subject}" to ${sent} contact${sent === 1 ? "" : "s"}.`,
  );
  if (cc.length + bcc.length > 0) {
    parts.push(
      copySent
        ? `One copy went to the ${cc.length + bcc.length} copied in.`
        : "The copy to the people copied in could not be sent.",
    );
  }

  return progress({
    ok: failed === 0 && copySent,
    message: parts.join(" "),
    draftId,
    total,
    sent,
    failed,
    done: true,
  });
}

/* -------------------------------------------------------------------------- */
/* What the composer opens with                                                */
/* -------------------------------------------------------------------------- */

/**
 * The wording to pre-fill a new email with: whatever was used last, falling
 * back to the house defaults.
 *
 * A remembered last value rather than a settings page, because the two are the
 * same thing in practice and only one of them is another form to keep. The
 * first email an admin writes gets the defaults; every one after that starts
 * where they left off.
 */
export async function lastUsedWrapper(): Promise<{
  greeting: string;
  signOff: string;
  footerNote: string;
  buttons: EmailButton[];
}> {
  const previous = await prisma.broadcast.findFirst({
    where: { status: { in: ["SENT", "DRAFT"] }, NOT: { greeting: "" } },
    orderBy: { updatedAt: "desc" },
    select: { greeting: true, signOff: true, footerNote: true, buttons: true },
  });

  return {
    greeting: previous?.greeting || DEFAULT_GREETING,
    signOff: previous?.signOff || DEFAULT_SIGN_OFF,
    footerNote: previous?.footerNote || DEFAULT_FOOTER_NOTE,
    buttons: parseButtons(previous?.buttons),
  };
}
