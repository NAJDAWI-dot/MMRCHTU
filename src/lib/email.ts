import { Resend } from "resend";
import { optionalEnv } from "@/lib/env";
import {
  faqNotificationEmail,
  registrationConfirmationEmail,
  type FaqNotificationData,
  type RegistrationConfirmationData,
} from "@/lib/email-templates";

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
  const { adminNotificationEmail, siteUrl } = optionalEnv;

  if (!adminNotificationEmail) {
    console.warn(`[email] Skipped FAQ admin notification — ADMIN_NOTIFICATION_EMAIL not configured.`);
    return;
  }

  const { subject, html, text } = faqNotificationEmail({ ...data, siteUrl });
  await sendEmail(adminNotificationEmail, subject, html, text);
}

export async function sendRegistrationConfirmation(
  to: string,
  data: Omit<RegistrationConfirmationData, "siteUrl">,
): Promise<void> {
  const { siteUrl } = optionalEnv;
  const { subject, html, text } = registrationConfirmationEmail({ ...data, siteUrl });
  await sendEmail(to, subject, html, text);
}
