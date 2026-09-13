/**
 * What a composed broadcast is, and what makes one sendable.
 *
 * The list page can now write a whole email rather than a subject and a box of
 * text: the wording around the message, the buttons under it, extra recipients
 * beside it, and files with it. That is a lot of small rules, and they have to
 * hold in three places — the composer as it is typed, the action when it is
 * saved, and the send itself. So they live here, once, free of React, Prisma
 * and the DOM.
 */

import { parseContactInput } from "@/lib/broadcast";
import { renderRichText, safeHref } from "@/lib/rich-text";

export const MAX_SUBJECT_LENGTH = 200;
export const MAX_BUTTONS = 3;
export const MAX_BUTTON_LABEL_LENGTH = 60;
export const MAX_WRAPPER_LENGTH = 200;

/**
 * How many people can be copied in.
 *
 * A cap rather than none, because cc is not how you mail a list — the list is,
 * and it sends everyone their own private copy. This is for the two or three
 * people who need to see that it went out.
 */
export const MAX_EXTRA_RECIPIENTS = 25;

/** The one substitution the greeting understands. */
export const NAME_TOKEN = "{name}";

export const DEFAULT_GREETING = `Hi ${NAME_TOKEN},`;
export const DEFAULT_SIGN_OFF = "IEEE RAS HTU Student Chapter";
export const DEFAULT_FOOTER_NOTE =
  "You are receiving this because you are on an MMRC 26 mailing list.";

export interface EmailButton {
  label: string;
  href: string;
}

/**
 * The greeting with the recipient's own name in it.
 *
 * When there is no name — a contact added as a bare address, which most
 * imported ones are — the token is removed along with the space in front of it,
 * so "Hi {name}," becomes "Hi," rather than "Hi ," or, worse, "Hi {name},"
 * arriving in somebody's inbox exactly as written.
 */
export function applyGreeting(template: string, name?: string | null): string {
  const person = (name ?? "").trim();
  if (person) return template.split(NAME_TOKEN).join(person);
  return template
    .split(NAME_TOKEN)
    .join("")
    .replace(/\s{2,}/g, " ")
    // The space the token left behind, now sitting in front of the comma.
    .replace(/\s+([,.!?])/g, "$1")
    .trim();
}

/* -------------------------------------------------------------------------- */
/* Buttons                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Buttons back out of the JSON column, defensively.
 *
 * Anything unreadable becomes no buttons rather than an exception. This is
 * read while *displaying* a draft, and a stored value that cannot be parsed
 * must not be able to take the whole email list page down with it.
 */
export function parseButtons(raw: string | null | undefined): EmailButton[] {
  if (!raw) return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(value)) return [];
  const buttons: EmailButton[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const label = String((entry as { label?: unknown }).label ?? "").trim();
    const href = safeHref(String((entry as { href?: unknown }).href ?? ""));
    if (!label || !href) continue;
    buttons.push({ label: label.slice(0, MAX_BUTTON_LABEL_LENGTH), href });
    if (buttons.length === MAX_BUTTONS) break;
  }
  return buttons;
}

export function serialiseButtons(buttons: readonly EmailButton[]): string {
  return JSON.stringify(buttons.slice(0, MAX_BUTTONS));
}

/* -------------------------------------------------------------------------- */
/* Extra recipients                                                            */
/* -------------------------------------------------------------------------- */

export interface AddressList {
  addresses: string[];
  error?: string;
}

/**
 * A cc or bcc field into addresses.
 *
 * Reuses the list's own contact parser, so "Name <a@b.c>", commas, semicolons
 * and one-per-line all work here exactly as they do when adding people to the
 * list — an admin should not have to learn two syntaxes for typing an address
 * on the same page.
 */
export function parseAddressList(raw: string | null | undefined, field: "Cc" | "Bcc"): AddressList {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { addresses: [] };

  const { contacts, invalid } = parseContactInput(trimmed);
  if (invalid.length) {
    return {
      addresses: contacts.map((c) => c.email),
      error: `${field}: not a valid email address: ${invalid.join(", ")}`,
    };
  }
  if (contacts.length > MAX_EXTRA_RECIPIENTS) {
    return {
      addresses: contacts.slice(0, MAX_EXTRA_RECIPIENTS).map((c) => c.email),
      error: `${field}: ${contacts.length} addresses. Up to ${MAX_EXTRA_RECIPIENTS} can be copied in. Send to a list instead.`,
    };
  }
  return { addresses: contacts.map((c) => c.email) };
}

/* -------------------------------------------------------------------------- */
/* The email itself                                                            */
/* -------------------------------------------------------------------------- */

export interface ComposeInput {
  subject?: string | null;
  bodyHtml?: string | null;
  greeting?: string | null;
  signOff?: string | null;
  footerNote?: string | null;
  buttons?: readonly EmailButton[] | null;
  cc?: string | null;
  bcc?: string | null;
}

export interface ComposedEmail {
  subject: string;
  bodyHtml: string;
  greeting: string;
  signOff: string;
  footerNote: string;
  buttons: EmailButton[];
  cc: string[];
  bcc: string[];
}

export interface ComposeErrors {
  subject?: string;
  body?: string;
  buttons?: string;
  cc?: string;
  bcc?: string;
  /** Nothing to send to: no contacts on the list and nobody copied in. */
  recipients?: string;
}

export function hasComposeErrors(errors: ComposeErrors): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * The input tidied into what gets stored, with nothing rejected.
 *
 * Saving a draft has to accept a half-written email — that is what a draft is —
 * so the shaping and the judging are separate functions and only sending calls
 * both.
 */
export function normaliseCompose(input: ComposeInput): ComposedEmail {
  return {
    subject: (input.subject ?? "").trim().slice(0, MAX_SUBJECT_LENGTH),
    bodyHtml: input.bodyHtml ?? "",
    greeting: (input.greeting ?? "").trim().slice(0, MAX_WRAPPER_LENGTH),
    signOff: (input.signOff ?? "").trim().slice(0, MAX_WRAPPER_LENGTH),
    footerNote: (input.footerNote ?? "").trim().slice(0, MAX_WRAPPER_LENGTH),
    buttons: (input.buttons ?? [])
      .map((button) => ({
        label: button.label.trim().slice(0, MAX_BUTTON_LABEL_LENGTH),
        href: (button.href ?? "").trim(),
      }))
      // A row with neither half filled in is an unused slot in the editor, not
      // a mistake to complain about.
      .filter((button) => button.label || button.href)
      .slice(0, MAX_BUTTONS),
    cc: parseAddressList(input.cc, "Cc").addresses,
    bcc: parseAddressList(input.bcc, "Bcc").addresses,
  };
}

/**
 * Whether this can be sent.
 *
 * `contactCount` is passed in because a broadcast with an empty list is still
 * sendable when somebody is copied in — a note to the two organisers about a
 * list nobody has been added to yet is a real thing to want to send.
 */
export function validateCompose(
  input: ComposeInput,
  context: { contactCount: number },
): ComposeErrors {
  const errors: ComposeErrors = {};
  const subject = (input.subject ?? "").trim();

  if (!subject) {
    errors.subject = "Add a subject.";
  } else if (subject.length > MAX_SUBJECT_LENGTH) {
    errors.subject = `Subjects are cut off in most inboxes past ${MAX_SUBJECT_LENGTH} characters.`;
  }

  if (!renderRichText(input.bodyHtml).hasContent) {
    errors.body = "Write the message before sending it.";
  }

  for (const button of input.buttons ?? []) {
    const label = button.label.trim();
    const href = (button.href ?? "").trim();
    if (!label && !href) continue;
    if (!label) {
      errors.buttons = "A button needs words on it as well as a link.";
      break;
    }
    if (!href) {
      errors.buttons = `"${label}" has no link. Add one or remove the button.`;
      break;
    }
    if (!safeHref(href)) {
      errors.buttons = `"${label}" does not link anywhere a mail client will follow. Use a full https:// address, a mailto:, or a path like /rules.`;
      break;
    }
  }

  const cc = parseAddressList(input.cc, "Cc");
  if (cc.error) errors.cc = cc.error;
  const bcc = parseAddressList(input.bcc, "Bcc");
  if (bcc.error) errors.bcc = bcc.error;

  if (context.contactCount === 0 && cc.addresses.length === 0 && bcc.addresses.length === 0) {
    errors.recipients =
      "There's nobody to send to. This list has no contacts and nobody is copied in.";
  }

  return errors;
}

/**
 * What the send will actually do, in one sentence, for the button that does it.
 *
 * Written here rather than in the component because it is the sentence the
 * admin reads before pressing send, and getting it wrong — saying 40 when it is
 * 41 — is how somebody sends an email they did not mean to.
 */
export function describeSend(context: {
  contactCount: number;
  cc: readonly string[];
  bcc: readonly string[];
}): string {
  const parts: string[] = [];
  if (context.contactCount > 0) {
    parts.push(`${context.contactCount} contact${context.contactCount === 1 ? "" : "s"}`);
  }
  const copied = context.cc.length + context.bcc.length;
  if (copied > 0) parts.push(`${copied} copied in`);
  if (parts.length === 0) return "Nobody to send to";
  return `Send to ${parts.join(" and ")}`;
}
