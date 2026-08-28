/**
 * Where a registration stands in the competition.
 *
 * Its own leaf module, free of Prisma, so the admin page's dropdown and the
 * action that writes the value read from the same list. They used to be two
 * literals — a `STATUS_OPTIONS` array in the page and no check at all in the
 * action — which meant the write accepted any string at all and the two could
 * drift without anything noticing.
 *
 * Deliberately not PaymentStatus (src/lib/payment.ts). A team can be CONFIRMED
 * on merit with the fee outstanding, and refusing a payment must never cancel a
 * registration behind someone's back.
 */

export type RegistrationStatus = "PENDING" | "CONFIRMED" | "WAITLISTED" | "CANCELLED";

/** In the order the admin dropdown offers them, which is roughly a lifecycle. */
export const REGISTRATION_STATUSES: readonly RegistrationStatus[] = [
  "PENDING",
  "CONFIRMED",
  "WAITLISTED",
  "CANCELLED",
] as const;

export function isRegistrationStatus(value: unknown): value is RegistrationStatus {
  return typeof value === "string" && (REGISTRATION_STATUSES as readonly string[]).includes(value);
}

/**
 * The status to store for a submitted value, or null to refuse the write.
 *
 * Null rather than a fallback to PENDING: silently rewriting an unrecognised
 * status would turn a bad request into a state change nobody asked for, and
 * "CONFIRMED became PENDING because the form posted junk" is a far worse
 * outcome than the update failing loudly.
 */
export function parseRegistrationStatus(value: unknown): RegistrationStatus | null {
  return isRegistrationStatus(value) ? value : null;
}
