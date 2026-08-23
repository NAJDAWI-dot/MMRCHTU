import { Resend } from "resend";
import { headers } from "next/headers";
import { optionalEnv } from "@/lib/env";
import {
  broadcastEmail,
  faqNotificationEmail,
  registrationConfirmationEmail,
  type FaqNotificationData,
  type RegistrationConfirmationData,
} from "@/lib/email-templates";

/**
 * Prefer the incoming request's actual host (so links stay correct when the
 * dev server lands on 3001/3002 because 3000 was already taken, or in prod
 * behind a proxy) over the SITE_URL env var, which is only a fallback for
 * contexts with no request (there are none currently, but keep it safe).
 */
function getSiteUrl(): string {
  try {
    const headerList = headers();
    const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
    if (!host) return optionalEnv.siteUrl;
    const proto = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  } catch {
    return optionalEnv.siteUrl;
  }
}

/**
 * Best-effort email send via the Resend HTTP API. Silently no-ops (with a
 * console log) if RESEND_API_KEY isn't configured yet — a missing key must
 * never block the action that triggered the email (registration, a FAQ
 * question).
 */
async function sendEmail(to: string, subject: string, html: string, text: string): Promise<boolean> {
  const { resendApiKey, resendFromEmail } = optionalEnv;

  if (!resendApiKey) {
    console.warn(`[email] Skipped "${subject}" to ${to} — RESEND_API_KEY not configured.`);
    return false;
  }

  if (!resendFromEmail) {
    console.warn(`[email] Skipped "${subject}" to ${to} — RESEND_FROM_EMAIL not configured.`);
    return false;
  }

  try {
    const resend = new Resend(resendApiKey);
    const { error } = await resend.emails.send({ from: resendFromEmail, to, subject, html, text });
    if (error) {
      console.error(`[email] Failed to send "${subject}" to ${to}:`, error);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`[email] Failed to send "${subject}" to ${to}:`, error);
    return false;
  }
}

export async function sendAdminNotification(data: Omit<FaqNotificationData, "siteUrl">): Promise<void> {
  const { adminNotificationEmail } = optionalEnv;

  if (!adminNotificationEmail) {
    console.warn(`[email] Skipped FAQ admin notification — ADMIN_NOTIFICATION_EMAIL not configured.`);
    return;
  }

  const { subject, html, text } = faqNotificationEmail({ ...data, siteUrl: getSiteUrl() });
  await sendEmail(adminNotificationEmail, subject, html, text);
}

export interface BroadcastRecipient {
  email: string;
  name?: string | null;
}

export interface BroadcastSendResult {
  sent: number;
  failed: number;
  failedEmails: string[];
}

/**
 * Sends one personalised copy per recipient rather than a single message with
 * everyone in `to:` — the list members must not see each other's addresses.
 *
 * Sends are sequential with a short gap: Resend's default rate limit is 2
 * requests/second, and a parallel fan-out over a list of any size trips it and
 * fails most of the batch. A failed recipient is recorded and the run
 * continues, so one bad address can't abort the whole broadcast.
 */
export async function sendBroadcast(
  recipients: BroadcastRecipient[],
  subject: string,
  body: string,
): Promise<BroadcastSendResult> {
  const siteUrl = getSiteUrl();
  const result: BroadcastSendResult = { sent: 0, failed: 0, failedEmails: [] };

  for (const recipient of recipients) {
    const { html, text } = broadcastEmail({ subject, body, recipientName: recipient.name, siteUrl });
    const ok = await sendEmail(recipient.email, subject, html, text);
    if (ok) {
      result.sent++;
    } else {
      result.failed++;
      result.failedEmails.push(recipient.email);
    }
    await new Promise((resolve) => setTimeout(resolve, 550));
  }

  return result;
}

export async function sendRegistrationConfirmation(
  to: string,
  data: Omit<RegistrationConfirmationData, "siteUrl">,
): Promise<void> {
  const { subject, html, text } = registrationConfirmationEmail({ ...data, siteUrl: getSiteUrl() });
  await sendEmail(to, subject, html, text);
}
