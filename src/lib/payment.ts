/**
 * The CliQ registration fee: amounts, references, and what state a payment is in.
 *
 * CliQ is a bank-to-bank transfer, not a card gateway — there is no API to call
 * and no callback to wait for. The team pays from their own banking app to the
 * chapter's alias, then reports the transaction reference; a human reconciles
 * it against the account. So the job of this module is not to *take* money, it
 * is to describe a payment precisely enough that someone can match it to a bank
 * statement without a phone call.
 *
 * Free of React, the DOM and the database, like the rest of `lib` — the money
 * arithmetic in particular has to be testable on its own.
 */

/* -------------------------------------------------------------------------- */
/* Amounts                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Jordanian dinars subdivide into 1000 fils, and money is stored in fils.
 *
 * Not because anyone will pay 35.001 JD, but because floating-point dinars
 * accumulate error the moment they are summed for a report, and "34.99999999"
 * in a total is the kind of bug that is embarrassing rather than merely wrong.
 */
export const FILS_PER_JOD = 1000;

/** Nobody is paying more than this for a student competition; a larger number is a typo. */
export const MAX_FEE_FILS = 1000 * FILS_PER_JOD;

/**
 * Parses a typed amount into fils.
 *
 * Accepts what people actually type — "35", "35.5", "35.500", " 35 JD ", and
 * Arabic-Indic digits, which a phone keyboard set to Arabic produces without
 * the person noticing. Returns null for anything it cannot read, rather than a
 * silent zero.
 */
export function parseAmountToFils(input: string): number | null {
  const cleaned = normaliseDigits(input)
    .replace(/[\s,]/g, "")
    // Strip a currency suffix or prefix in either script.
    .replace(/jod|jd|دينار|د\.ا/gi, "")
    .trim();

  if (!cleaned) return null;
  if (!/^\d+(\.\d{1,3})?$/.test(cleaned)) return null;

  const [whole, fraction = ""] = cleaned.split(".");
  const fils = Number(whole) * FILS_PER_JOD + Number(fraction.padEnd(3, "0"));

  if (!Number.isFinite(fils) || fils <= 0 || fils > MAX_FEE_FILS) return null;
  return fils;
}

/** "35 JD", "35.500 JD" — trailing zeros dropped, because 35.000 reads oddly. */
export function formatFils(fils: number): string {
  const whole = Math.floor(fils / FILS_PER_JOD);
  const remainder = fils % FILS_PER_JOD;
  if (remainder === 0) return `${whole} JD`;
  return `${whole}.${String(remainder).padStart(3, "0").replace(/0+$/, "")} JD`;
}

/**
 * Arabic-Indic and Eastern Arabic-Indic digits to ASCII.
 *
 * A phone keyboard in Arabic types ٣٥, which is the same number and fails every
 * numeric regex written without this.
 */
function normaliseDigits(value: string): string {
  return value.replace(/[٠-٩۰-۹]/g, (d) => {
    const code = d.charCodeAt(0);
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(code - base);
  });
}

/* -------------------------------------------------------------------------- */
/* References                                                                  */
/* -------------------------------------------------------------------------- */

export const MAX_REFERENCE_LENGTH = 64;

/**
 * Tidies a transaction reference for storage and comparison.
 *
 * Banks print references with spaces and in mixed case, and people retype them
 * from a screenshot. Normalising means the same payment reported twice matches
 * itself, and an admin searching a statement finds it.
 */
export function normaliseReference(raw: string): string {
  return normaliseDigits(raw)
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, MAX_REFERENCE_LENGTH);
}

/* -------------------------------------------------------------------------- */
/* Status                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Deliberately separate from RegistrationStatus.
 *
 * A team can be confirmed on merit with the fee outstanding, and refusing a
 * payment must not cancel a registration behind someone's back. Conflating the
 * two would make "CANCELLED" mean two different things.
 */
export type PaymentStatus = "UNPAID" | "SUBMITTED" | "VERIFIED" | "REJECTED";

export const PAYMENT_STATUSES: PaymentStatus[] = ["UNPAID", "SUBMITTED", "VERIFIED", "REJECTED"];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  UNPAID: "Not paid",
  SUBMITTED: "Awaiting check",
  VERIFIED: "Paid",
  REJECTED: "Not matched",
};

/** What the team is told, which is not what the admin list says. */
export const PAYMENT_STATUS_BLURB: Record<PaymentStatus, string> = {
  UNPAID: "We have not recorded a payment for your team yet.",
  SUBMITTED: "We have your reference and are matching it against the account.",
  VERIFIED: "Your fee is paid and confirmed. Nothing further to do.",
  REJECTED: "We could not match this reference. Please check it and send it again.",
};

export function isPaymentStatus(value: unknown): value is PaymentStatus {
  return typeof value === "string" && (PAYMENT_STATUSES as string[]).includes(value);
}

/* -------------------------------------------------------------------------- */
/* Who decided                                                                 */
/* -------------------------------------------------------------------------- */

/** The columns `paymentActor` reads. Structural, so a Prisma row satisfies it. */
export interface PaymentActorSource {
  paymentStatus: string;
  paymentStatusBy: string | null;
  paymentStatusAt: Date | null;
  paymentVerifiedBy: string | null;
  paymentVerifiedAt: Date | null;
}

export interface PaymentActor {
  /** "Marked Paid", "Marked Not matched" — the status in the past tense. */
  label: string;
  /** Null where the change was recorded before anyone's name was being kept. */
  who: string | null;
  at: Date | null;
}

/**
 * Who last decided this payment's status, and when.
 *
 * Every status now carries an actor, not only VERIFIED. A payment sitting at
 * "Not matched" is a decision somebody made — usually the one most worth being
 * able to ask about — and until these columns existed the row recorded no
 * trace of who made it.
 *
 * Falls back to the older verified-only pair for rows whose last change
 * predates the new columns, so a payment verified last month still names the
 * admin who verified it instead of going blank on the day this shipped.
 *
 * Returns null when genuinely nothing is recorded, which the caller should
 * render as absence rather than as "nobody".
 */
export function paymentActor(row: PaymentActorSource): PaymentActor | null {
  const status = isPaymentStatus(row.paymentStatus) ? row.paymentStatus : null;
  const label = status ? `Marked ${PAYMENT_STATUS_LABELS[status]}` : "Last changed";

  if (row.paymentStatusBy || row.paymentStatusAt) {
    return { label, who: row.paymentStatusBy, at: row.paymentStatusAt };
  }

  // Legacy rows: the only actor ever written was on verification.
  if (status === "VERIFIED" && (row.paymentVerifiedBy || row.paymentVerifiedAt)) {
    return { label, who: row.paymentVerifiedBy, at: row.paymentVerifiedAt };
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Submission                                                                  */
/* -------------------------------------------------------------------------- */

export interface PaymentInput {
  reference?: string | null;
  amount?: string | null;
}

export interface PaymentFieldErrors {
  reference?: string;
  amount?: string;
}

export interface ParsedPayment {
  reference: string | null;
  amountFils: number | null;
  /** True once there is something worth an admin looking at. */
  submitted: boolean;
}

export interface ValidatePaymentOptions {
  /**
   * Treat an entirely blank report as an error rather than as "not yet".
   *
   * The payment stage sets this: a team only reaches that form after saying
   * they have paid, so two empty fields there are a mistake. Left off, the
   * original behaviour holds — blank means nothing has been reported.
   */
  required?: boolean;
}

/**
 * Validates and parses what the team reported.
 *
 * A half-filled report is worse than none: a reference with no amount, or an
 * amount with no reference, cannot be reconciled, so both are required together
 * once either is given.
 *
 * Whether *neither* is acceptable depends on where the form sits, which is what
 * `options.required` selects. One function with a flag rather than two nearly
 * identical ones, because the interesting rules — reference length, how an
 * amount parses — must not be allowed to drift between the two callers.
 */
export function validatePayment(
  input: PaymentInput,
  options: ValidatePaymentOptions = {},
): PaymentFieldErrors {
  const rawReference = (input.reference ?? "").trim();
  const rawAmount = (input.amount ?? "").trim();
  const errors: PaymentFieldErrors = {};

  if (!rawReference && !rawAmount) {
    if (!options.required) return errors;
    return {
      reference: "Enter the transaction reference from your banking app.",
      amount: "Enter the amount you transferred.",
    };
  }

  const reference = normaliseReference(rawReference);
  if (!reference) {
    errors.reference = "Enter the transaction reference from your banking app.";
  } else if (reference.length < 4) {
    errors.reference = "That reference looks too short — check it against your receipt.";
  }

  if (!rawAmount) {
    errors.amount = "Enter the amount you transferred.";
  } else if (parseAmountToFils(rawAmount) === null) {
    errors.amount = "Enter the amount in dinars, for example 25 or 25.500.";
  }

  return errors;
}

export function hasPaymentErrors(errors: PaymentFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Assumes `validatePayment` already passed. */
export function parsePayment(input: PaymentInput): ParsedPayment {
  const reference = normaliseReference((input.reference ?? "").trim()) || null;
  const amountFils = parseAmountToFils((input.amount ?? "").trim());
  return { reference, amountFils, submitted: Boolean(reference && amountFils) };
}

/* -------------------------------------------------------------------------- */
/* Configuration                                                               */
/* -------------------------------------------------------------------------- */

export type CliqAliasType = "ALIAS" | "MOBILE";

export interface CliqDetails {
  paymentEnabled: boolean;
  cliqAlias: string;
  cliqAliasType: string;
  cliqBankName: string;
  cliqAccountName: string;
  paymentNote: string;
}

/**
 * Whether there is enough here to ask anyone for money.
 *
 * The alias is the part that cannot be guessed or defaulted — a panel showing a
 * blank or placeholder alias would send transfers into the void, so the whole
 * payment section stays hidden until an admin has entered one and switched it
 * on.
 */
export function isPaymentConfigured(config: CliqDetails): boolean {
  return config.paymentEnabled && config.cliqAlias.trim().length > 0;
}

export function aliasTypeLabel(value: string): string {
  return value === "MOBILE" ? "Mobile number" : "CliQ alias";
}

/** Mobile aliases are dialable; named aliases are not. */
export function isMobileAlias(value: string): boolean {
  return value === "MOBILE";
}
