"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  createRegistration,
  feeTierForTeam,
  validateRegistration,
  hasFieldErrors,
  type FieldErrors,
  type IeeeStatus,
  type TeamMemberInput,
} from "@/lib/registration";
import { isPaymentConfigured, validatePayment, type CliqDetails } from "@/lib/payment";
import { computeFee, type FeeBreakdown } from "@/lib/pricing";
import { getPaymentConfig } from "@/lib/site-config";
import { paymentScreenshotKey } from "@/lib/payment-proof";
import { checkUpload } from "@/lib/gallery";
import { StorageNotConfiguredError, storePhoto } from "@/lib/photo-storage";
import { createRateLimiter, clientKey } from "@/lib/rate-limit";

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

function readTeam(formData: FormData) {
  const memberCount = Number(formData.get("memberCount") ?? 1);
  return {
    teamName: String(formData.get("teamName") ?? ""),
    submitterEmail: String(formData.get("submitterEmail") ?? ""),
    memberCount,
    technicalExperience: String(formData.get("technicalExperience") ?? ""),
    motivation: String(formData.get("motivation") ?? ""),
    consentAccepted: formData.get("consentAccepted") === "on",
    members: Array.from({ length: memberCount }, (_, i) =>
      readMember(formData, i + 1),
    ) as TeamMemberInput[],
  };
}

export interface TeamCheckState {
  status: "idle" | "ok" | "error";
  errors?: FieldErrors;
  /** What the team will owe, so step two can show it without a second round trip. */
  fee?: FeeBreakdown;
  /**
   * How to pay, sent only once step one has passed.
   *
   * Deliberately returned here rather than passed into the form as a prop: a
   * prop would be serialised into step one's payload, putting the chapter's
   * CliQ alias in the page source of a step that is supposed to be about the
   * team and nothing else. Null when an admin has not configured payment.
   */
  cliq?: CliqDetails | null;
}

/**
 * Stage one's "Next": checks the team details and quotes the fee, storing
 * nothing.
 *
 * The browser keeps the answers until the team actually reports a payment.
 * Validation still runs on the server rather than only in the page, because the
 * same rules have to hold at the point of the real write and there should be
 * exactly one copy of them.
 */
export async function checkTeamDetails(
  _prevState: TeamCheckState,
  formData: FormData,
): Promise<TeamCheckState> {
  const input = readTeam(formData);

  const errors = validateRegistration(input);
  if (hasFieldErrors(errors)) {
    return { status: "error", errors };
  }

  const config = await getPaymentConfig();
  const fee = computeFee(feeTierForTeam(input.members), config, config);

  return {
    status: "ok",
    fee,
    // Null unless an admin has switched payment on *and* entered an alias — a
    // panel with a blank alias would send money nowhere.
    cliq: isPaymentConfigured(config) ? config : null,
  };
}

export interface CompleteRegistrationErrors {
  reference?: string;
  amount?: string;
  screenshot?: string;
  /** Something that is not about one field: a rate limit, a team-details problem. */
  form?: string;
}

export interface CompleteRegistrationState {
  status: "idle" | "success" | "error";
  errors?: CompleteRegistrationErrors;
  teamErrors?: FieldErrors;
  registered?: {
    teamName: string;
    resumeCode: string;
    feeDueFils: number;
  };
}

/**
 * Public, unauthenticated write: enough for a team fixing a mistyped
 * reference, not enough to be worth scripting.
 */
const submitLimiter = createRateLimiter({ limit: 8, windowMs: 10 * 60 * 1000 });

/**
 * Stage two's submit: the only point at which anything is stored.
 *
 * The team's details and their payment report are written together, so a
 * half-finished registration never reaches the database — a team that gives up
 * partway leaves nothing behind for anyone to chase.
 */
export async function completeRegistration(
  _prevState: CompleteRegistrationState,
  formData: FormData,
): Promise<CompleteRegistrationState> {
  const limit = submitLimiter.check(clientKey(headers()));
  if (!limit.allowed) {
    const minutes = Math.ceil(limit.retryAfterMs / 60000);
    return {
      status: "error",
      errors: { form: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` },
    };
  }

  const team = readTeam(formData);

  // Re-checked rather than trusted: stage one's pass happened in an earlier
  // request, and the hidden fields carrying it here are editable.
  const teamErrors = validateRegistration(team);
  if (hasFieldErrors(teamErrors)) {
    return {
      status: "error",
      teamErrors,
      errors: { form: "Some of your team details need fixing — go back and check them." },
    };
  }

  const reference = String(formData.get("paymentReference") ?? "");
  const amount = String(formData.get("paymentAmount") ?? "");
  const errors: CompleteRegistrationErrors = validatePayment(
    { reference, amount },
    { required: true },
  );

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

  const screenshot = file as File;
  // Keyed on a fresh id rather than the registration's, which does not exist
  // yet — the row is created immediately below, in this same call.
  const key = paymentScreenshotKey(
    randomUUID().replace(/-/g, ""),
    screenshot.name,
    randomUUID().slice(0, 8),
  );

  let stored;
  try {
    stored = await storePhoto(key, screenshot);
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) {
      return { status: "error", errors: { screenshot: error.message } };
    }
    throw error;
  }

  const registration = await createRegistration({
    ...team,
    payment: {
      reference,
      amount,
      screenshotUrl: stored.url,
      screenshotKey: stored.key,
    },
  });

  revalidatePath("/admin/payments");
  revalidatePath("/admin/registrations");

  return {
    status: "success",
    registered: {
      teamName: registration.teamName,
      resumeCode: registration.resumeCode ?? "",
      feeDueFils: registration.feeDueFils ?? 0,
    },
  };
}
