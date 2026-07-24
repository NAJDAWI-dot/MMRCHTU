// Inline-styled HTML email templates (no external stylesheet/image
// dependency — most mail clients strip <style> blocks and won't reliably
// load remote assets) using the site's IEEE RAS palette.

const PURPLE = "#5F2167";
const CRIMSON = "#862633";
const GRAY = "#57565B";
const BORDER = "#e3dde5";
const SURFACE = "#f7f5f8";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nl2br(text: string): string {
  return escapeHtml(text).replace(/\n/g, "<br>");
}

function baseEmailHtml(preheader: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>MMRC 26</title>
  </head>
  <body style="margin:0; padding:0; background-color:${SURFACE}; font-family:'Segoe UI', Helvetica, Arial, sans-serif;">
    <span style="display:none; font-size:1px; color:${SURFACE}; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">
      ${escapeHtml(preheader)}
    </span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${SURFACE}; padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px; max-width:92%; background-color:#ffffff; border-radius:12px; overflow:hidden; border:1px solid ${BORDER};">
            <tr>
              <td style="background-color:${PURPLE}; padding:28px 32px;">
                <span style="font-family:'Segoe UI', Helvetica, Arial, sans-serif; font-size:20px; font-weight:800; color:#ffffff; letter-spacing:0.02em;">
                  MMRC 26
                </span>
                <div style="margin-top:2px; font-size:12px; color:rgba(255,255,255,0.75); letter-spacing:0.08em; text-transform:uppercase;">
                  IEEE RAS HTU Student Chapter
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px; color:#1a1a1a; font-size:14px; line-height:1.6;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px; background-color:${SURFACE}; border-top:1px solid ${BORDER}; font-size:12px; color:${GRAY};">
                Micro Mouse Robot Competition 2026 &middot; IEEE Robotics &amp; Automation Society, HTU Student Chapter
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function button(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block; margin-top:20px; padding:10px 24px; background-color:${CRIMSON}; color:#ffffff; text-decoration:none; font-weight:700; font-size:13px; letter-spacing:0.03em; border-radius:999px;">${escapeHtml(label)}</a>`;
}

export interface FaqNotificationData {
  question: string;
  askerEmail?: string | null;
  siteUrl: string;
}

export function faqNotificationEmail(data: FaqNotificationData): { subject: string; html: string; text: string } {
  const subject = "New FAQ question submitted — MMRC 26";
  const html = baseEmailHtml(
    "A new question was submitted on the FAQ page.",
    `
      <h1 style="margin:0 0 12px; font-size:18px; color:${PURPLE};">New FAQ question</h1>
      <p style="margin:0 0 16px; color:${GRAY};">A visitor submitted a new question on the FAQ page:</p>
      <div style="margin:0 0 16px; padding:16px; background-color:${SURFACE}; border-left:3px solid ${PURPLE}; border-radius:6px;">
        <p style="margin:0; font-style:italic;">&ldquo;${nl2br(data.question)}&rdquo;</p>
      </div>
      <p style="margin:0 0 4px; color:${GRAY}; font-size:13px;">
        ${data.askerEmail ? `Asker's email: <strong>${escapeHtml(data.askerEmail)}</strong>` : "No reply email was provided."}
      </p>
      ${button("Reply in the admin panel", `${data.siteUrl}/admin/faq`)}
    `,
  );
  const text = `New FAQ question submitted on MMRC 26\n\n"${data.question}"\n\n${data.askerEmail ? `Asker's email: ${data.askerEmail}` : "No reply email was provided."}\n\nReply: ${data.siteUrl}/admin/faq`;
  return { subject, html, text };
}

export interface RegistrationConfirmationMember {
  order: number;
  firstName: string;
  lastName: string;
  university: string;
  major: string;
}

export interface RegistrationConfirmationData {
  teamName: string;
  members: RegistrationConfirmationMember[];
  siteUrl: string;
}

export function registrationConfirmationEmail(
  data: RegistrationConfirmationData,
): { subject: string; html: string; text: string } {
  const subject = `You're registered for MMRC 26 — ${data.teamName}`;

  const memberRows = data.members
    .map(
      (m) => `
      <tr>
        <td style="padding:8px 0; border-bottom:1px solid ${BORDER}; font-size:13px;">
          <strong>${escapeHtml(m.firstName)} ${escapeHtml(m.lastName)}</strong>${m.order === 1 ? ' <span style="color:' + CRIMSON + '; font-size:11px; font-weight:700; text-transform:uppercase;">Team Leader</span>' : ""}
          <div style="color:${GRAY};">${escapeHtml(m.university)} &middot; ${escapeHtml(m.major)}</div>
        </td>
      </tr>`,
    )
    .join("");

  const html = baseEmailHtml(
    `Your team ${data.teamName} is registered for MMRC 26.`,
    `
      <h1 style="margin:0 0 12px; font-size:18px; color:${PURPLE};">You&apos;re registered! 🐭</h1>
      <p style="margin:0 0 16px; color:${GRAY};">
        Thanks for applying to the 2026 Maze Solver Robot Competition. Here&apos;s a summary of your submission:
      </p>
      <div style="margin:0 0 16px; padding:16px; background-color:${SURFACE}; border-radius:8px;">
        <p style="margin:0 0 8px; font-size:15px; font-weight:700; color:${PURPLE};">${escapeHtml(data.teamName)}</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${memberRows}
        </table>
      </div>
      <p style="margin:0 0 8px; color:${GRAY};">
        <strong>What happens next?</strong> Applications are screened on a rolling basis. If your team is selected,
        we&apos;ll reach out to your team lead by email to complete verification and fee payment.
      </p>
      <p style="margin:0; color:${GRAY};">
        Remember: your robot must be physically present on competition day to be checked in.
      </p>
      ${button("View schedule", `${data.siteUrl}/schedule`)}
    `,
  );

  const memberLines = data.members
    .map((m) => `${m.order}. ${m.firstName} ${m.lastName}${m.order === 1 ? " (Team Leader)" : ""} — ${m.university}, ${m.major}`)
    .join("\n");
  const text = `You're registered for MMRC 26!\n\nTeam: ${data.teamName}\n\n${memberLines}\n\nApplications are screened on a rolling basis. Selected teams will be contacted for verification and fee payment.\n\nSchedule: ${data.siteUrl}/schedule`;

  return { subject, html, text };
}
