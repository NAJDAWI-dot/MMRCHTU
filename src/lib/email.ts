import { Resend } from "resend";
import { headers } from "next/headers";
import { optionalEnv } from "@/lib/env";
import { siteOrigin } from "@/lib/site-url";
import type { EmailButton } from "@/lib/broadcast-compose";
import {
  broadcastEmail,
  faqNotificationEmail,
  registrationConfirmationEmail,
  type FaqNotificationData,
  type RegistrationConfirmationData,
} from "@/lib/email-templates";

/**
 * Prefer the incoming request's actual host (so links stay correct when the dev
 * server lands on 3001/3002 because 3000 was already taken, or in prod behind a
 * proxy), falling back to the site's canonical origin when there is no request
 * to read.
 *
 * That fallback goes through siteOrigin() rather than reading SITE_URL directly.
 * SITE_URL is not set in this project's environment, so the old direct read
 * resolved the no-request path to localhost — and an email full of localhost
 * links is both useless and quiet, since nothing throws. siteOrigin() also knows
 * Vercel's own domain variables, so it has a real answer in production whether
 * or not anyone remembers to set SITE_URL.
 */
function getSiteUrl(): string {
  try {
    const headerList = headers();
    const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
    if (!host) return siteOrigin();
    const proto = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  } catch {
    return siteOrigin();
  }
}

export interface EmailAttachment {
  /** The name the recipient sees. */
  filename: string;
  /** Where the provider fetches the bytes from. */
  url: string;
}

interface SendOptions {
  cc?: readonly string[];
  bcc?: readonly string[];
  attachments?: readonly EmailAttachment[];
}

/**
 * Best-effort email send via the Resend HTTP API. Silently no-ops (with a
 * console log) if RESEND_API_KEY isn't configured yet — a missing key must
 * never block the action that triggered the email (registration, a FAQ
 * question).
 *
 * Attachments are handed over as URLs rather than as bytes. The alternative is
 * base64 in the request body, which inflates every file by a third and means a
 * 40-recipient broadcast uploads the same PDF forty times.
 */
async function sendEmail(
  to: string | readonly string[],
  subject: string,
  html: string,
  text: string,
  options: SendOptions = {},
): Promise<boolean> {
  const { resendApiKey, resendFromEmail } = optionalEnv;
  const label = Array.isArray(to) ? to.join(", ") : String(to);

  if (!resendApiKey) {
    console.warn(`[email] Skipped "${subject}" to ${label}: RESEND_API_KEY not configured.`);
    return false;
  }

  if (!resendFromEmail) {
    console.warn(`[email] Skipped "${subject}" to ${label}: RESEND_FROM_EMAIL not configured.`);
    return false;
  }

  try {
    const resend = new Resend(resendApiKey);
    const { error } = await resend.emails.send({
      from: resendFromEmail,
      to: Array.isArray(to) ? [...to] : (to as string),
      subject,
      html,
      text,
      ...(options.cc?.length ? { cc: [...options.cc] } : {}),
      ...(options.bcc?.length ? { bcc: [...options.bcc] } : {}),
      ...(options.attachments?.length
        ? { attachments: options.attachments.map((file) => ({ filename: file.filename, path: file.url })) }
        : {}),
    });
    if (error) {
      console.error(`[email] Failed to send "${subject}" to ${label}:`, error);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`[email] Failed to send "${subject}" to ${label}:`, error);
    return false;
  }
}

export async function sendAdminNotification(data: Omit<FaqNotificationData, "siteUrl">): Promise<void> {
  const { adminNotificationEmail } = optionalEnv;

  if (!adminNotificationEmail) {
    console.warn(`[email] Skipped FAQ admin notification: ADMIN_NOTIFICATION_EMAIL not configured.`);
    return;
  }

  const { subject, html, text } = faqNotificationEmail({ ...data, siteUrl: getSiteUrl() });
  await sendEmail(adminNotificationEmail, subject, html, text);
}

export interface BroadcastRecipient {
  email: string;
  name?: string | null;
}

/** Everything about the email that does not change from recipient to recipient. */
export interface BroadcastMessage {
  subject: string;
  bodyHtml: string;
  greeting: string;
  signOff: string;
  footerNote: string;
  buttons: readonly EmailButton[];
  attachments: readonly EmailAttachment[];
}

export interface BroadcastSendResult {
  sent: number;
  failed: number;
  failedEmails: string[];
  /** Whether the single copy to the people cc'd or bcc'd went out. */
  copySent: boolean;
  copyAttempted: boolean;
}

/** Pacing between sends. Resend's default limit is 2 requests a second. */
const SEND_GAP_MS = 550;

function pause(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, SEND_GAP_MS));
}

/**
 * Sends one personalised copy per recipient rather than a single message with
 * everyone in `to:` — the list members must not see each other's addresses, and
 * the greeting carries each person's own name.
 *
 * Sends are sequential with a short gap, because a parallel fan-out over a list
 * of any size trips the provider's rate limit and fails most of the batch. A
 * failed recipient is recorded and the run continues, so one bad address cannot
 * abort a whole broadcast.
 *
 * Anyone cc'd or bcc'd gets ONE copy, sent after the list, not one per
 * recipient. Copying somebody in on a mailing list is a request to show them
 * what went out; on forty individual messages the literal reading would send
 * them forty emails, which is never what was meant. That copy is addressed to
 * the cc'd people themselves when there are any, so they can see each other as
 * cc implies, and to the sending address when the copy is blind — a message
 * still needs somebody in `to:`.
 */
export async function sendBroadcast(
  recipients: readonly BroadcastRecipient[],
  message: BroadcastMessage,
  extra: { cc: readonly string[]; bcc: readonly string[] } = { cc: [], bcc: [] },
): Promise<BroadcastSendResult> {
  const siteUrl = getSiteUrl();
  const result: BroadcastSendResult = {
    sent: 0,
    failed: 0,
    failedEmails: [],
    copySent: false,
    copyAttempted: false,
  };

  for (const recipient of recipients) {
    const { html, text } = broadcastEmail({
      ...message,
      recipientName: recipient.name,
      siteUrl,
    });
    const ok = await sendEmail(recipient.email, message.subject, html, text, {
      attachments: message.attachments,
    });
    if (ok) {
      result.sent += 1;
    } else {
      result.failed += 1;
      result.failedEmails.push(recipient.email);
    }
    await pause();
  }

  const copied = [...extra.cc, ...extra.bcc];
  if (copied.length > 0) {
    result.copyAttempted = true;
    // No name to greet: this copy goes to several people at once, so the
    // greeting falls back to its nameless form rather than addressing all of
    // them as whoever happens to be first.
    const { html, text } = broadcastEmail({ ...message, recipientName: null, siteUrl });
    const to = extra.cc.length > 0 ? extra.cc : [optionalEnv.resendFromEmail ?? ""];
    result.copySent = await sendEmail(to, message.subject, html, text, {
      bcc: extra.bcc,
      attachments: message.attachments,
    });
  }

  return result;
}

/**
 * One copy of exactly what the list would receive, to an address the admin
 * types.
 *
 * The point is that it is not a special "test" rendering — the same template,
 * the same buttons, the same attachments — because a preview that is built
 * differently from the real thing is a preview of something else.
 */
export async function sendBroadcastTest(
  to: string,
  message: BroadcastMessage,
  recipientName?: string | null,
): Promise<boolean> {
  const { html, text } = broadcastEmail({
    ...message,
    recipientName: recipientName ?? null,
    siteUrl: getSiteUrl(),
  });
  return sendEmail(to, `[Test] ${message.subject}`, html, text, {
    attachments: message.attachments,
  });
}

export async function sendRegistrationConfirmation(
  to: string,
  data: Omit<RegistrationConfirmationData, "siteUrl">,
): Promise<void> {
  const { subject, html, text } = registrationConfirmationEmail({ ...data, siteUrl: getSiteUrl() });
  await sendEmail(to, subject, html, text);
}
