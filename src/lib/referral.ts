import { randomBytes } from "node:crypto";

/**
 * Ambassador referral codes.
 *
 * Each university ambassador gets one code. A team types it on the register
 * form (or arrives through a /register?ref=CODE link) and the registration is
 * counted against that ambassador on the admin Ambassadors tab.
 *
 * Free of Prisma so the rules can be tested without a database, the same split
 * as registration-code.ts.
 */

export const AMBASSADOR_STATUSES = ["ACTIVE", "PAUSED"] as const;
export type AmbassadorStatus = (typeof AMBASSADOR_STATUSES)[number];

export function isAmbassadorStatus(value: unknown): value is AmbassadorStatus {
  return typeof value === "string" && (AMBASSADOR_STATUSES as readonly string[]).includes(value);
}

export const REFERRAL_CODE_MIN = 3;
export const REFERRAL_CODE_MAX = 20;
const REFERRAL_CODE_RE = /^[A-Z0-9-]+$/;

/**
 * Codes are case-insensitive and ignore spaces, so "htu omar" and "HTU-OMAR"
 * typed by a team both land on what the admin created.
 */
export function normaliseReferralCode(raw: string): string {
  return raw.toUpperCase().replace(/\s+/g, "").slice(0, 64);
}

/** Why a code cannot be used as an ambassador's code, or null if it can. */
export function referralCodeFormatProblem(code: string): string | null {
  if (code.length < REFERRAL_CODE_MIN || code.length > REFERRAL_CODE_MAX) {
    return `The code must be ${REFERRAL_CODE_MIN} to ${REFERRAL_CODE_MAX} characters.`;
  }
  if (!REFERRAL_CODE_RE.test(code)) {
    return "Use only letters, numbers and hyphens.";
  }
  return null;
}

/** Same alphabet as the resume codes: no 0/O, 1/I/L to misread off a poster. */
const SUFFIX_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/**
 * A code for an ambassador when the admin leaves the box empty: the first
 * letters of their first name plus three random characters, like "OMAR7K2".
 * `random` is injectable so tests can pin the output.
 */
export function suggestReferralCode(
  name: string,
  random: () => number = () => randomBytes(4).readUInt32BE(0) / 2 ** 32,
): string {
  const letters = (name.trim().split(/\s+/)[0] ?? "")
    .normalize("NFKD")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 6);
  const prefix = letters.length >= 2 ? letters : "MMRC";
  let suffix = "";
  for (let i = 0; i < 3; i++) {
    const index = Math.floor(random() * SUFFIX_ALPHABET.length);
    suffix += SUFFIX_ALPHABET[Math.min(index, SUFFIX_ALPHABET.length - 1)];
  }
  return `${prefix}${suffix}`;
}

export interface AmbassadorInput {
  name: string;
  university: string;
  code: string;
}

export interface AmbassadorErrors {
  name?: string;
  code?: string;
}

export function validateAmbassador(input: AmbassadorInput): AmbassadorErrors {
  const errors: AmbassadorErrors = {};
  if (input.name.trim().length < 2) {
    errors.name = "Enter the ambassador's name.";
  }
  // An empty code is fine here: the action generates one.
  if (input.code) {
    const problem = referralCodeFormatProblem(input.code);
    if (problem) errors.code = problem;
  }
  return errors;
}

/**
 * What a team sees when the code they typed cannot be used, or null when it
 * can. An empty box is always fine: the field is optional.
 */
export function referralCodeError(
  code: string,
  ambassador: { status: string } | null,
): string | null {
  if (!code) return null;
  if (!ambassador) {
    return "We don't recognise that referral code. Check it with your ambassador, or leave the box empty.";
  }
  if (ambassador.status !== "ACTIVE") {
    return "That referral code isn't active right now. Leave the box empty to continue.";
  }
  return null;
}
