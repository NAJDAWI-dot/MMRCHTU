// Inline-styled HTML email templates (most mail clients strip <style> blocks)
// using the site's IEEE RAS palette.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { MMRC_PLATE } from "@/lib/brand";
import { formatFils } from "@/lib/payment";
import { VERIFICATION_WINDOW_TEXT } from "@/lib/payment-proof";

const PURPLE = "#5F2167";
const PURPLE_DEEP = "#3F1546";
const CRIMSON = "#862633";
const GOLD = "#F2A900";
const GRAY = "#57565B";
const BORDER = "#e3dde5";
const SURFACE = "#f7f5f8";

/**
 * The marks in the email header: the HTU logo, the IEEE RAS HTU Student Chapter
 * lockup, and the MMRC 26 mark. The plain IEEE RAS mark is deliberately not
 * here — the chapter lockup already carries it.
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
  /*
    The MMRC mark carries a plate, and needs one here more than anywhere: the
    band behind these logos is white, and the left half of the glyph is white
    too. Without it, half the logo would simply not be in the email.
  */
  { file: "mmrc-mark.png", alt: "MMRC 26", size: 40, plate: MMRC_PLATE },
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
  /*
    A plated logo gets its ground from the cell's background-color rather than
    from a second baked image — background-color on a <td> is one of the few
    things every mail client agrees on, where border-radius is not. Outlook
    will render the plate square; that is the whole cost.
  */
  const logo = (file: string, alt: string, size: number, plate?: string) => {
    const ground = plate
      ? `background-color:${plate}; border-radius:8px; padding:5px;`
      : "";
    return `<td align="center" valign="middle" style="padding:0 10px;">
       <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
         <tr><td align="center" valign="middle" style="${ground}">
           <img src="${siteUrl}/brand/logo/${file}" alt="${escapeHtml(alt)}"
                width="${size}" height="${size}"
                style="display:block; width:${size}px; height:${size}px; border:0; outline:none; text-decoration:none;" />
         </td></tr>
       </table>
     </td>`;
  };

  const divider = `<td valign="middle" style="padding:0 4px;">
      <div style="width:1px; height:36px; background-color:${BORDER};"></div>
    </td>`;

  const cells = AVAILABLE_LOGOS.map((l) => logo(l.file, l.alt, l.size, "plate" in l ? l.plate : undefined));

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
  /**
   * The team's reference for this registration.
   *
   * This email is the only durable copy: the success screen is gone as soon as
   * they close the tab. It also opens a read-only status page, which is what a
   * team reaches for on day two of waiting for verification.
   */
  resumeCode: string;
  feeBaseFils: number;
  feeDiscountFils: number;
  feeDueFils: number;
  earlyBirdApplied: boolean;
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

  const statusUrl = `${data.siteUrl}/register?code=${encodeURIComponent(data.resumeCode)}`;

  const discountRow = data.earlyBirdApplied
    ? `
        <tr>
          <td style="padding:2px 0; font-size:13px; color:${GRAY};">Early bird discount</td>
          <td style="padding:2px 0; font-size:13px; color:${GRAY}; text-align:right;">&minus;${escapeHtml(formatFils(data.feeDiscountFils))}</td>
        </tr>`
    : "";

  const html = baseEmailHtml(
    `${data.teamName} is registered — we are checking your payment now.`,
    `
      ${heading("You&apos;re registered! 🐭")}
      <p style="margin:0 0 20px; color:${GRAY};">
        Thanks for entering the 2026 Maze Solver Robot Competition. We have your registration and
        your payment, and we are checking the payment against our account now.
      </p>
      <div style="margin:0 0 20px; padding:18px 20px; background-color:${SURFACE}; border:1px solid ${BORDER}; border-radius:10px;">
        <div style="font-size:11px; font-weight:600; color:${GRAY}; letter-spacing:0.12em; text-transform:uppercase;">Team</div>
        <p style="margin:2px 0 10px; font-size:17px; font-weight:800; color:${PURPLE};">${escapeHtml(data.teamName)}</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${memberRows}
        </table>
      </div>

      <div style="margin:0 0 20px; padding:18px 20px; background-color:${SURFACE}; border:1px solid ${BORDER}; border-radius:10px;">
        <div style="font-size:11px; font-weight:600; color:${GRAY}; letter-spacing:0.12em; text-transform:uppercase;">Your fee</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px;">
          <tr>
            <td style="padding:2px 0; font-size:13px; color:${GRAY};">Registration fee</td>
            <td style="padding:2px 0; font-size:13px; color:${GRAY}; text-align:right;">${escapeHtml(formatFils(data.feeBaseFils))}</td>
          </tr>
          ${discountRow}
          <tr>
            <td style="padding:8px 0 0; font-size:17px; font-weight:800; color:${PURPLE}; border-top:1px solid ${BORDER};">Total</td>
            <td style="padding:8px 0 0; font-size:17px; font-weight:800; color:${PURPLE}; text-align:right; border-top:1px solid ${BORDER};">${escapeHtml(formatFils(data.feeDueFils))}</td>
          </tr>
        </table>
        <p style="margin:14px 0 4px; font-size:11px; font-weight:600; color:${GRAY}; letter-spacing:0.12em; text-transform:uppercase;">Your reference</p>
        <p style="margin:0; font-family:'Courier New', monospace; font-size:24px; font-weight:800; letter-spacing:0.18em; color:${PURPLE};">${escapeHtml(data.resumeCode)}</p>
        <p style="margin:8px 0 0; font-size:12px; color:${GRAY};">
          Quote this if you need to ask us anything about your registration.
        </p>
      </div>

      <p style="margin:0 0 8px; color:${GRAY};">
        <strong>What happens next?</strong> Checking a CliQ transfer against our account is done by
        hand, so it takes <strong>${VERIFICATION_WINDOW_TEXT}</strong> — longer over a weekend or a
        public holiday. We will email you as soon as it is confirmed. You do not need to send
        anything else in the meantime.
      </p>
      <p style="margin:0; color:${GRAY};">
        Remember: your robot must be physically present on competition day to be checked in.
      </p>
      ${button("Check your payment status", statusUrl)}
    `,
    data.siteUrl,
  );

  const memberLines = data.members
    .map((m) => `${m.order}. ${m.firstName} ${m.lastName}${m.order === 1 ? " (Team Leader)" : ""} — ${m.university}, ${m.major}`)
    .join("\n");
  const discountLine = data.earlyBirdApplied
    ? `\nEarly bird discount: -${formatFils(data.feeDiscountFils)}`
    : "";
  const text = `You're registered for MMRC 26!\n\nTeam: ${data.teamName}\n\n${memberLines}\n\nRegistration fee: ${formatFils(data.feeBaseFils)}${discountLine}\nTotal: ${formatFils(data.feeDueFils)}\n\nYour reference: ${data.resumeCode}\nQuote this if you need to ask us anything about your registration.\n\nWhat happens next: checking a CliQ transfer against our account is done by hand, so it takes ${VERIFICATION_WINDOW_TEXT} — longer over a weekend or a public holiday. We will email you as soon as it is confirmed. You do not need to send anything else.\n\nCheck your status: ${statusUrl}`;

  return { subject, html, text };
}
