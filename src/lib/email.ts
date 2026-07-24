import { Resend } from "resend";
import { headers } from "next/headers";
import { optionalEnv } from "@/lib/env";
import {
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

// resend.dev's shared test sender only delivers to the Resend account's own
// verified email — swap this for a verified custom domain address once one
// is set up (e.g. "MMRC 26 <notifications@mmrc26.org>") so mail reaches
// arbitrary recipients (registrants, FAQ askers) rather than just the
// account owner.
const FROM_ADDRESS = "MMRC 26 <onboarding@resend.dev>";

/**
 * Best-effort email send via the Resend HTTP API. Silently no-ops (with a
 * console log) if RESEND_API_KEY isn't configured yet — a missing key must
 * never block the action that triggered the email (registration, a FAQ
 * question).
 */
async function sendEmail(to: string, subject: string, html: string, text: string): Promise<void> {
  const { resendApiKey } = optionalEnv;

  if (!resendApiKey) {
    console.warn(`[email] Skipped "${subject}" to ${to} — RESEND_API_KEY not configured.`);
    return;
  }

  try {
    const resend = new Resend(resendApiKey);
    await resend.emails.send({ from: FROM_ADDRESS, to, subject, html, text });
  } catch (error) {
    console.error(`[email] Failed to send "${subject}" to ${to}:`, error);
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

export async function sendRegistrationConfirmation(
  to: string,
  data: Omit<RegistrationConfirmationData, "siteUrl">,
): Promise<void> {
  const { subject, html, text } = registrationConfirmationEmail({ ...data, siteUrl: getSiteUrl() });
  await sendEmail(to, subject, html, text);
}
