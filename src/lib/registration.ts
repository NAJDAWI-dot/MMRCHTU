import { prisma } from "@/lib/prisma";
import { sendRegistrationConfirmation } from "@/lib/email";
import { IEEE_STATUS_OPTIONS, type IeeeStatus } from "@/lib/ieee-status";
import { computeFee, isFeeTier, type FeeTier } from "@/lib/pricing";
import { parsePayment } from "@/lib/payment";
import { createUniqueResumeCode } from "@/lib/registration-code";
import { getPaymentConfig } from "@/lib/site-config";

export { IEEE_STATUS_OPTIONS, type IeeeStatus };

/**
 * Which revision of the legal pages a registration agreed to.
 *
 * Stored per registration so rewriting the terms later never retroactively
 * changes what somebody consented to. Bump this by hand whenever the wording in
 * content/legal changes materially — a typo fix does not count, a new clause
 * about refunds does.
 *
 * The 2026-08-29 bump looks like it breaks that rule, since the rewrite into the
 * passive voice changed no fee, deadline, right or obligation. It does not: the
 * documents gained a clause declaring that an unnamed actor means IEEE RAS HTU,
 * which is an instruction on how to read every other sentence in them. This
 * field records which text was agreed to, not only what that text meant, and
 * every sentence in all four was rewritten.
 */
export const CONSENT_VERSION = "2026-08-29";

// Status is constrained in the application rather than the database (see
// prisma/schema.prisma) — this is the single source of truth for the valid
// values.
export type RegistrationStatus = "PENDING" | "CONFIRMED" | "WAITLISTED" | "CANCELLED";

export interface TeamMemberInput {
  firstName: string;
  lastName: string;
  email: string;
  whatsapp: string;
  university: string;
  major: string;
  ieeeStatus: IeeeStatus;
  ieeeMembershipId: string;
}

/** What the team reported transferring, captured with the registration itself. */
export interface RegistrationPaymentInput {
  reference: string;
  amount: string;
  screenshotUrl: string;
  screenshotKey: string;
}

export interface RegistrationInput {
  /** Whether the team ticked the box agreeing to the terms and policies. */
  consentAccepted: boolean;
  teamName: string;
  submitterEmail: string;
  memberCount: number;
  technicalExperience: string;
  motivation: string;
  members: TeamMemberInput[];
  payment: RegistrationPaymentInput;
}

/**
 * The tier a team is priced at: whatever the team leader's IEEE status says.
 *
 * One fee for the team, decided by the person registering it, rather than a
 * separate question asking the same thing a second time. Asking twice invites
 * the two answers to disagree, and then somebody has to decide which of a
 * team's own statements about itself is the real one.
 */
export function feeTierForTeam(members: readonly { ieeeStatus: IeeeStatus }[]): FeeTier {
  const leader = members[0]?.ieeeStatus;
  return leader && isFeeTier(leader) ? leader : "NON_MEMBER";
}

export interface TeamMemberFieldErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  whatsapp?: string;
  university?: string;
  major?: string;
  ieeeStatus?: string;
  ieeeMembershipId?: string;
}

export interface FieldErrors {
  teamName?: string;
  submitterEmail?: string;
  memberCount?: string;
  technicalExperience?: string;
  motivation?: string;
  consentAccepted?: string;
  members?: (TeamMemberFieldErrors | undefined)[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IEEE_STATUS_VALUES: IeeeStatus[] = ["IEEE_RAS_MEMBER", "IEEE_MEMBER", "NON_MEMBER"];

/** Largest team the rules allow, and the ceiling on anything sized by it. */
export const MAX_TEAM_SIZE = 3;

function validateMember(member: Partial<TeamMemberInput> | undefined): TeamMemberFieldErrors | undefined {
  const errors: TeamMemberFieldErrors = {};

  if (!member?.firstName || member.firstName.trim().length < 1) {
    errors.firstName = "First name is required.";
  }
  if (!member?.lastName || member.lastName.trim().length < 1) {
    errors.lastName = "Last name is required.";
  }
  if (!member?.email || !EMAIL_RE.test(member.email)) {
    errors.email = "Enter a valid email address.";
  }
  if (!member?.whatsapp || member.whatsapp.trim().length < 6) {
    errors.whatsapp = "Enter a valid WhatsApp number.";
  }
  if (!member?.university || member.university.trim().length < 1) {
    errors.university = "Select a university.";
  }
  if (!member?.major || member.major.trim().length < 1) {
    errors.major = "Major is required.";
  }
  if (!member?.ieeeStatus || !IEEE_STATUS_VALUES.includes(member.ieeeStatus)) {
    errors.ieeeStatus = "Select an IEEE membership status.";
  }
  if (!member?.ieeeMembershipId || member.ieeeMembershipId.trim().length < 1) {
    errors.ieeeMembershipId = 'Enter your IEEE membership ID, or "Non-Member" if you have none.';
  }

  return Object.keys(errors).length > 0 ? errors : undefined;
}

export interface RegistrationValidationInput extends Omit<Partial<RegistrationInput>, "members"> {
  members?: Partial<TeamMemberInput>[];
}

export function validateRegistration(input: RegistrationValidationInput): FieldErrors {
  const errors: FieldErrors = {};

  if (!input.teamName || input.teamName.trim().length < 2) {
    errors.teamName = "Team name must be at least 2 characters.";
  }
  if (!input.submitterEmail || !EMAIL_RE.test(input.submitterEmail)) {
    errors.submitterEmail = "Enter a valid email address.";
  }
  if (
    input.memberCount === undefined ||
    !Number.isInteger(input.memberCount) ||
    input.memberCount < 1 ||
    input.memberCount > MAX_TEAM_SIZE
  ) {
    errors.memberCount = "Team size must be 1, 2, or 3.";
  }
  if (!input.technicalExperience || input.technicalExperience.trim().length < 1) {
    errors.technicalExperience = "Briefly describe the technical experience of each member.";
  }
  if (!input.motivation || input.motivation.trim().length < 1) {
    errors.motivation = "Tell us your motivation to participate.";
  }
  if (!input.consentAccepted) {
    // Blocking rather than assuming: this is the record that the team agreed to
    // the terms before money changed hands, so it cannot be inferred.
    errors.consentAccepted = "Please accept the terms and policies to continue.";
  }

  // Clamped, not merely checked for integer-ness: this is used as an array
  // length, and an out-of-range count has already been reported above, so there
  // is nothing to gain by walking a hundred million imaginary members to say so
  // a second time. Callers should bound this before it reaches here — see
  // readTeam in src/app/register/actions.ts — but this function is exported and
  // can be called directly, so it does not depend on them having done it.
  const rawCount = input.memberCount;
  const expectedCount =
    rawCount !== undefined && Number.isInteger(rawCount) && rawCount >= 1 && rawCount <= MAX_TEAM_SIZE
      ? rawCount
      : 0;
  const members = input.members ?? [];
  const memberErrors = Array.from({ length: expectedCount }, (_, i) => validateMember(members[i]));
  if (memberErrors.some(Boolean)) {
    errors.members = memberErrors;
  }

  return errors;
}

export function hasFieldErrors(errors: FieldErrors): boolean {
  return (
    Object.keys(errors).filter((k) => k !== "members").length > 0 ||
    (errors.members?.some(Boolean) ?? false)
  );
}

export async function createRegistration(input: RegistrationInput) {
  const paymentConfig = await getPaymentConfig();

  // Priced once, here, and written to the row. Deliberately not recomputed on
  // read: the prices and the early-bird window both move over time, and a team
  // that registered while the discount was running must keep the figure they
  // were quoted rather than watch their balance rise when the cutoff passes.
  const fee = computeFee(feeTierForTeam(input.members), paymentConfig, paymentConfig);

  const reported = parsePayment({
    reference: input.payment.reference,
    amount: input.payment.amount,
  });

  const resumeCode = await createUniqueResumeCode(async (code) => {
    const clash = await prisma.registration.findUnique({
      where: { resumeCode: code },
      select: { id: true },
    });
    return clash !== null;
  });

  return prisma.$transaction(async (tx) => {
    const registration = await tx.registration.create({
      data: {
        teamName: input.teamName.trim(),
        submitterEmail: input.submitterEmail.trim(),
        memberCount: input.memberCount,
        technicalExperience: input.technicalExperience.trim(),
        motivation: input.motivation.trim(),
        feeTier: fee.tier,
        feeBaseFils: fee.baseFils,
        feeDiscountFils: fee.discountFils,
        feeDueFils: fee.dueFils,
        resumeCode,
        consentAcceptedAt: new Date(),
        consentVersion: CONSENT_VERSION,
        // A report is a claim, not a payment. SUBMITTED until a human matches
        // it against the chapter's bank statement.
        paymentStatus: "SUBMITTED",
        paymentReference: reported.reference,
        paymentAmountFils: reported.amountFils,
        paymentSubmittedAt: new Date(),
        paymentScreenshotUrl: input.payment.screenshotUrl,
        paymentScreenshotKey: input.payment.screenshotKey,
        members: {
          create: input.members.map((member, i) => ({
            order: i + 1,
            firstName: member.firstName.trim(),
            lastName: member.lastName.trim(),
            email: member.email.trim(),
            whatsapp: member.whatsapp.trim(),
            university: member.university.trim(),
            major: member.major.trim(),
            ieeeStatus: member.ieeeStatus,
            ieeeMembershipId: member.ieeeMembershipId.trim(),
          })),
        },
      },
      include: { members: true },
    });

    await tx.counter.upsert({
      where: { key: "registrations" },
      update: { value: { increment: 1 } },
      create: { key: "registrations", value: 1 },
    });

    return registration;
  }).then(async (registration) => {
    await sendRegistrationConfirmation(registration.submitterEmail, {
      teamName: registration.teamName,
      members: registration.members.map((m) => ({
        order: m.order,
        firstName: m.firstName,
        lastName: m.lastName,
        university: m.university,
        major: m.major,
      })),
      resumeCode,
      feeBaseFils: fee.baseFils,
      feeDiscountFils: fee.discountFils,
      feeDueFils: fee.dueFils,
      earlyBirdApplied: fee.earlyBirdApplied,
    });
    return registration;
  });
}
