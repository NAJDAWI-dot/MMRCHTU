import { Resend } from "resend";
import { optionalEnv } from "@/lib/env";

/**
 * Best-effort admin notification email via the Resend HTTP API. Silently
 * no-ops (with a console log) if RESEND_API_KEY/ADMIN_NOTIFICATION_EMAIL
 * aren't configured yet — a missing key must never block the action that
 * triggered the email (e.g. a visitor submitting a FAQ question).
 */
export async function sendAdminNotification(subject: string, body: string): Promise<void> {
  const { resendApiKey, adminNotificationEmail } = optionalEnv;

  if (!resendApiKey || !adminNotificationEmail) {
    console.warn(
      `[email] Skipped admin notification "${subject}" — RESEND_API_KEY/ADMIN_NOTIFICATION_EMAIL not configured.`,
    );
    return;
  }

  try {
    const resend = new Resend(resendApiKey);
    // resend.dev's shared test sender only delivers to the Resend account's
    // own verified email — swap in a verified custom domain address once one
    // is set up (e.g. "MMRC 26 <notifications@mmrc26.org>").
    await resend.emails.send({
      from: "MMRC 26 <onboarding@resend.dev>",
      to: adminNotificationEmail,
      subject,
      text: body,
    });
  } catch (error) {
    console.error("[email] Failed to send admin notification:", error);
  }
}
