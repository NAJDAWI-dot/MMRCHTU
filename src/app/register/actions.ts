"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  createRegistration,
  validateRegistration,
  hasFieldErrors,
  type FieldErrors,
  type IeeeStatus,
  type TeamMemberInput,
} from "@/lib/registration";
import { hasPaymentErrors, parsePayment, validatePayment } from "@/lib/payment";
import { type FeeTier } from "@/lib/pricing";
import { normaliseResumeCode } from "@/lib/registration-code";
import { paymentScreenshotKey } from "@/lib/payment-proof";
import { checkUpload } from "@/lib/gallery";
import { StorageNotConfiguredError, storePhoto } from "@/lib/photo-storage";
import { createRateLimiter, clientKey } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";

/**
 * What stage two needs to render, handed over when stage one succeeds.
 *
 * Everything here is already frozen on the registration row — it is passed
 * through rather than recomputed so the figure on screen is provably the figure
 * that was stored.
 */
export interface PaymentStageData {
  resumeCode: string;
  teamName: string;
  feeBaseFils: number;
  feeDiscountFils: number;
  feeDueFils: number;
  earlyBirdApplied: boolean;
}

export interface RegisterActionState {
  status: "idle" | "success" | "error";
  errors?: FieldErrors;
  /** Present exactly when status is "success" — the handover into stage two. */
  payment?: PaymentStageData;
}

function readMember(formData: FormData, index: number): Partial<TeamMemberInput> {
  return {
    firstName: String(formData.get(`member${index}FirstName`) ?? ""),
    lastName: String(formData.get(`member${index}LastName`) ?? ""),
    email: String(formData.get(`member${index}Email`) ?? ""),
    whatsapp: String(formData.get(`member${index}Whatsapp`) ?? ""),
    university: String(formData.get(`member${index}University`) ?? ""),
    major: String(formData.get(`member${index}Major`) ?? ""),
    ieeeStatus: String(formData.get(`member${index}IeeeStatus`) ?? "") as IeeeStatus,
    ieeeMembershipId: String(formData.get(`member${index}IeeeMembershipId`) ?? ""),
  };
}

export async function registerTeam(
  _prevState: RegisterActionState,
  formData: FormData,
): Promise<RegisterActionState> {
  const memberCount = Number(formData.get("memberCount") ?? 1);

  const input = {
    teamName: String(formData.get("teamName") ?? ""),
    submitterEmail: String(formData.get("submitterEmail") ?? ""),
    memberCount,
    technicalExperience: String(formData.get("technicalExperience") ?? ""),
    motivation: String(formData.get("motivation") ?? ""),
    feeTier: String(formData.get("feeTier") ?? "") as FeeTier,
    consentAccepted: formData.get("consentAccepted") === "on",
    members: Array.from({ length: memberCount }, (_, i) => readMember(formData, i + 1)) as TeamMemberInput[],
  };

  const errors = validateRegistration(input);
  if (hasFieldErrors(errors)) {
    return { status: "error", errors };
  }

  const registration = await createRegistration(input);

  return {
    status: "success",
    payment: {
      // Non-null in practice: createRegistration always writes these. The
      // fallbacks exist only because the columns are nullable for rows that
      // predate pricing, which this row by definition is not.
      resumeCode: registration.resumeCode ?? "",
      teamName: registration.teamName,
      feeBaseFils: registration.feeBaseFils ?? 0,
      feeDiscountFils: registration.feeDiscountFils ?? 0,
      feeDueFils: registration.feeDueFils ?? 0,
      earlyBirdApplied: (registration.feeDiscountFils ?? 0) > 0,
    },
  };
}

export interface PaymentProofErrors {
  reference?: string;
  amount?: string;
  screenshot?: string;
  /** Something that is not about one field: an unknown code, a rate limit. */
  form?: string;
}

export interface PaymentProofState {
  status: "idle" | "success" | "error";
  errors?: PaymentProofErrors;
}

/**
 * Reporting a payment is a public, unauthenticated write — anyone holding a
 * resume code can post to it. Same budget as /api/register: enough for a team
 * that mistypes a reference a few times, not enough to be worth scripting.
 */
const proofLimiter = createRateLimiter({ limit: 8, windowMs: 10 * 60 * 1000 });

export async function submitPaymentProof(
  resumeCode: string,
  _prevState: PaymentProofState,
  formData: FormData,
): Promise<PaymentProofState> {
  const limit = proofLimiter.check(clientKey(headers()));
  if (!limit.allowed) {
    const minutes = Math.ceil(limit.retryAfterMs / 60000);
    return {
      status: "error",
      errors: { form: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` },
    };
  }

  const code = normaliseResumeCode(resumeCode);
  const registration = code
    ? await prisma.registration.findUnique({ where: { resumeCode: code } })
    : null;

  if (!registration) {
    return {
      status: "error",
      errors: { form: "We could not find a registration for that payment code." },
    };
  }

  const reference = String(formData.get("paymentReference") ?? "");
  const amount = String(formData.get("paymentAmount") ?? "");

  // Required here, unlike the old optional register-time report: a team only
  // reaches this form after they say they have paid, so blank fields are a
  // mistake rather than a deliberate "later".
  const errors: PaymentProofErrors = validatePayment({ reference, amount }, { required: true });

  const file = formData.get("screenshot");
  const hasFile = file instanceof File && file.size > 0;
  if (!hasFile) {
    errors.screenshot = "Attach a screenshot of your CliQ confirmation.";
  } else {
    const problem = checkUpload({ name: file.name, type: file.type, size: file.size });
    if (problem) errors.screenshot = problem;
  }

  if (errors.reference || errors.amount || errors.screenshot) {
    return { status: "error", errors };
  }

  const parsed = parsePayment({ reference, amount });
  const screenshot = file as File;

  let stored;
  try {
    stored = await storePhoto(
      paymentScreenshotKey(registration.id, screenshot.name, randomUUID().slice(0, 8)),
      screenshot,
    );
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) {
      return { status: "error", errors: { screenshot: error.message } };
    }
    throw error;
  }

  await prisma.registration.update({
    where: { id: registration.id },
    data: {
      paymentReference: parsed.reference,
      paymentAmountFils: parsed.amountFils,
      paymentScreenshotUrl: stored.url,
      paymentScreenshotKey: stored.key,
      // A report is a claim, not a payment. It stays SUBMITTED until a human
      // matches it against the account.
      paymentStatus: "SUBMITTED",
      paymentSubmittedAt: new Date(),
    },
  });

  revalidatePath("/admin/payments");

  return { status: "success" };
}
