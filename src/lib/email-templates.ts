// Inline-styled HTML email templates (most mail clients strip <style> blocks)
// using the site's IEEE RAS palette.

import { existsSync } from "node:fs";
import { join } from "node:path";

const PURPLE = "#5F2167";
const PURPLE_DEEP = "#3F1546";
const CRIMSON = "#862633";
const GOLD = "#F2A900";
const GRAY = "#57565B";
const BORDER = "#e3dde5";
const SURFACE = "#f7f5f8";

/**
 * The two marks in the email header: the HTU logo and the IEEE RAS HTU Student
 * Chapter lockup. The plain IEEE RAS mark is deliberately not here — the chapter
 * lockup already carries it.
 *
 * Logos are referenced as absolute URLs on the site rather than inlined: mail
 * clients block `data:` image URIs (Gmail strips them outright), so a hosted URL
 * is the only form that renders reliably. They sit on a white band because the
 * full-colour marks are drawn for a light background.
 *
 * Both files are square, but they are not equally *filled*: the chapter lockup's
 * artwork covers ~99% of its canvas while the HTU wordmark is letterboxed and
 * covers only ~38% of its height. Rendering both in one shared box would leave
 * the HTU mark looking half the size, so each carries its own dimensions, picked
 * so the visible artwork lands at a comparable height. Cells are middle-aligned
 * so the two sit on a shared centreline despite the different box heights.
 *
 * `width`/`height` attributes as well as CSS, because Outlook ignores the CSS.
 */
const HEADER_LOGOS = [
  // 96px box -> ~37px of visible wordmark (the rest is transparent margin).
  { file: "htu.png", alt: "Al-Hussein Technical University", size: 96 },
  { file: "lockup-htu-chapter.png", alt: "IEEE RAS HTU Student Chapter", size: 46 },
] as const;

/**
 * A missing file is skipped rather than emitted, so a logo we don't have never
 * ships as a broken image in every outgoing email. Resolved once at module load,
 * so adding a file needs a server restart.
 */
const AVAILABLE_LOGOS = HEADER_LOGOS.filter((logo) => {
  try {
    // Server-only module (imported by src/lib/email.ts), so node APIs are fine.
    return existsSync(join(process.cwd(), "public", "brand", "logo", logo.file));
  } catch {
    return false;
  }
});

function logoBar(siteUrl: string): string {
  const logo = (file: string, alt: string, size: number) =>
    `<td align="center" valign="middle" style="padding:0 10px;">
       <img src="${siteUrl}/brand/logo/${file}" alt="${escapeHtml(alt)}"
            width="${size}" height="${size}"
            style="display:block; width:${size}px; height:${size}px; border:0; outline:none; text-decoration:none;" />
     </td>`;

  const divider = `<td valign="middle" style="padding:0 4px;">
      <div style="width:1px; height:36px; background-color:${BORDER};"></div>
    </td>`;

  const cells = AVAILABLE_LOGOS.map((l) => logo(l.file, l.alt, l.size));

  return `
    <tr>
      <td align="center" style="background-color:#ffffff; padding:22px 32px 18px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            ${cells.join(divider)}
          </tr>
        </table>
      </td>
    </tr>`;
}

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

function baseEmailHtml(preheader: string, bodyHtml: string, siteUrl: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>MMRC 26</title>
  </head>
  <body style="margin:0; padding:0; background-color:${SURFACE}; font-family:'Segoe UI', Helvetica, Arial, sans-serif; -webkit-font-smoothing:antialiased;">
    <span style="display:none; font-size:1px; color:${SURFACE}; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">
      ${escapeHtml(preheader)}
    </span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${SURFACE}; padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="580" cellpadding="0" cellspacing="0" style="width:580px; max-width:92%; background-color:#ffffff; border-radius:14px; overflow:hidden; border:1px solid ${BORDER};">
            ${logoBar(siteUrl)}
            <tr>
              <td style="background-color:${PURPLE}; padding:26px 32px 24px;">
                <div style="font-size:11px; font-weight:600; color:${GOLD}; letter-spacing:0.16em; text-transform:uppercase;">
                  Micro Mouse Robot Competition
                </div>
                <div style="margin-top:6px; font-family:'Segoe UI', Helvetica, Arial, sans-serif; font-size:30px; font-weight:800; color:#ffffff; letter-spacing:0.01em; line-height:1.1;">
                  MMRC 26
                </div>
                <div style="margin-top:6px; font-size:12px; color:rgba(255,255,255,0.72);">
                  IEEE Robotics &amp; Automation Society &middot; HTU Student Chapter
                </div>
              </td>
            </tr>
            <tr>
              <td style="height:4px; background-color:${GOLD}; line-height:4px; font-size:0;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:32px; color:#1a1a1a; font-size:15px; line-height:1.65;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:22px 32px; background-color:${SURFACE}; border-top:1px solid ${BORDER}; font-size:12px; line-height:1.6; color:${GRAY};">
                <div style="font-weight:700; color:${PURPLE_DEEP};">Maze Solver Robot Competition 2026</div>
                <div style="margin-top:3px;">IEEE Robotics &amp; Automation Society &mdash; HTU Student Chapter</div>
                <div style="margin-top:10px;">
                  <a href="${siteUrl}/schedule" style="color:${CRIMSON}; text-decoration:none; font-weight:600;">Schedule</a>
                  <span style="color:${BORDER};"> &nbsp;|&nbsp; </span>
                  <a href="${siteUrl}/rules" style="color:${CRIMSON}; text-decoration:none; font-weight:600;">Rules</a>
                  <span style="color:${BORDER};"> &nbsp;|&nbsp; </span>
                  <a href="${siteUrl}/faq" style="color:${CRIMSON}; text-decoration:none; font-weight:600;">FAQ</a>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Heading used at the top of a message body. */
function heading(text: string): string {
  return `<h1 style="margin:0 0 14px; font-size:21px; font-weight:800; color:${PURPLE}; line-height:1.25;">${text}</h1>`;
}

function button(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block; margin-top:20px; padding:10px 24px; background-color:${CRIMSON}; color:#ffffff; text-decoration:none; font-weight:700; font-size:13px; letter-spacing:0.03em; border-radius:999px;">${escapeHtml(label)}</a>`;
}

export interface BroadcastEmailData {
  subject: string;
  /** Plain text written by the admin; newlines become <br> in the HTML part. */
  body: string;
  recipientName?: string | null;
  siteUrl: string;
}

/**
 * Admin-authored broadcast to a mailing list. The body is plain text rather
 * than HTML on purpose — it goes through nl2br/escapeHtml so an admin can't
 * accidentally (or deliberately) inject markup into outgoing mail.
 */
export function broadcastEmail(data: BroadcastEmailData): { subject: string; html: string; text: string } {
  const greeting = data.recipientName?.trim() ? `Hi ${escapeHtml(data.recipientName.trim())},` : "Hi,";

  const html = baseEmailHtml(
    data.body.slice(0, 140),
    `
      <p style="margin:0 0 16px; color:${GRAY};">${greeting}</p>
      <div style="margin:0 0 8px; color:#1a1a1a;">${nl2br(data.body)}</div>
      ${button("Visit the MMRC 26 site", data.siteUrl)}
    `,
    data.siteUrl,
  );

  const text = `${data.recipientName?.trim() ? `Hi ${data.recipientName.trim()},` : "Hi,"}\n\n${data.body}\n\n${data.siteUrl}`;

  return { subject: data.subject, html, text };
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
      ${heading("New FAQ question")}
      <p style="margin:0 0 16px; color:${GRAY};">A visitor submitted a new question on the FAQ page:</p>
      <div style="margin:0 0 16px; padding:16px; background-color:${SURFACE}; border-left:3px solid ${PURPLE}; border-radius:6px;">
        <p style="margin:0; font-style:italic;">&ldquo;${nl2br(data.question)}&rdquo;</p>
      </div>
      <p style="margin:0 0 4px; color:${GRAY}; font-size:13px;">
        ${data.askerEmail ? `Asker's email: <strong>${escapeHtml(data.askerEmail)}</strong>` : "No reply email was provided."}
      </p>
      ${button("Reply in the admin panel", `${data.siteUrl}/admin/faq`)}
    `,
    data.siteUrl,
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
      ${heading("You&apos;re registered! 🐭")}
      <p style="margin:0 0 20px; color:${GRAY};">
        Thanks for applying to the 2026 Maze Solver Robot Competition. Here&apos;s a summary of your submission:
      </p>
      <div style="margin:0 0 20px; padding:18px 20px; background-color:${SURFACE}; border:1px solid ${BORDER}; border-radius:10px;">
        <div style="font-size:11px; font-weight:600; color:${GRAY}; letter-spacing:0.12em; text-transform:uppercase;">Team</div>
        <p style="margin:2px 0 10px; font-size:17px; font-weight:800; color:${PURPLE};">${escapeHtml(data.teamName)}</p>
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
    data.siteUrl,
  );

  const memberLines = data.members
    .map((m) => `${m.order}. ${m.firstName} ${m.lastName}${m.order === 1 ? " (Team Leader)" : ""} — ${m.university}, ${m.major}`)
    .join("\n");
  const text = `You're registered for MMRC 26!\n\nTeam: ${data.teamName}\n\n${memberLines}\n\nApplications are screened on a rolling basis. Selected teams will be contacted for verification and fee payment.\n\nSchedule: ${data.siteUrl}/schedule`;

  return { subject, html, text };
}
