"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  createRegistration,
  feeTierForTeam,
  validateRegistration,
  hasFieldErrors,
  MAX_TEAM_SIZE,
  type FieldErrors,
  type IeeeStatus,
  type TeamMemberInput,
} from "@/lib/registration";
import { isPaymentConfigured, validatePayment, type CliqDetails } from "@/lib/payment";
import { computeFee, type FeeBreakdown } from "@/lib/pricing";
import { getPaymentConfig, getRegisterFormConfig } from "@/lib/site-config";
import { paymentScreenshotKey } from "@/lib/payment-proof";
import { checkUpload } from "@/lib/gallery";
import { StorageNotConfiguredError, removePhoto, storePhoto } from "@/lib/photo-storage";
import { createRateLimiter, clientKey } from "@/lib/rate-limit";

/** Shown when an admin has closed registration, on either step. */
const CLOSED_MESSAGE =
  "Registration is closed. If you think this is a mistake, contact the organizing committee.";

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
  // Bounded before it is used as a length. `memberCount` arrives from the
  // network, and `Array.from({ length: n })` allocates eagerly — so a posted
  // memberCount of 100000000 would build a hundred million member objects and
  // exhaust the process, all before validateRegistration ever got the chance to
  // say the team is too big. Anything out of range collapses to zero members,
  // which is precisely what the validator already rejects, so a genuine typo
  // still produces the same "Team size must be 1, 2, or 3" it always did.
  const rawCount = Number(formData.get("memberCount") ?? 1);
  const memberCount =
    Number.isInteger(rawCount) && rawCount >= 1 && rawCount <= MAX_TEAM_SIZE ? rawCount : 0;

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
  /**
   * Something that is not about any one field: registration being closed, or a
   * rate limit. Kept separate from `errors` so these never get filed against a
   * field the person can "fix" by editing it.
   */
  formError?: string;
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
 * Public and unauthenticated, like the submit below, but deliberately loose.
 *
 * `clientKey` is an IP address, and most of the teams registering share one:
 * a university lab, campus wifi, a phone network's NAT. So the ceiling has to
 * clear a whole room of people registering in the same ten minutes, which a
 * tight limit would read as an attack. It is set where a person cannot
 * plausibly reach it and a script cannot plausibly stay under it — the real
 * protection against a flood is that this handler now does bounded work per
 * request (see readTeam), not that it counts them.
 */
const checkLimiter = createRateLimiter({ limit: 60, windowMs: 10 * 60 * 1000 });

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
  const limit = checkLimiter.check(clientKey(headers()));
  if (!limit.allowed) {
    const minutes = Math.ceil(limit.retryAfterMs / 60000);
    return {
      status: "error",
      formError: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    };
  }

  // Checked here as well as in the page, because the page only decides what to
  // render — the form it rendered while registration was open can still be
  // submitted after it closes, and a browser tab left open all week will do
  // exactly that.
  const form = await getRegisterFormConfig();
  if (!form.isOpen) {
    return { status: "error", formError: CLOSED_MESSAGE };
  }

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

  const [form, paymentConfig] = await Promise.all([getRegisterFormConfig(), getPaymentConfig()]);

  if (!form.isOpen) {
    return { status: "error", errors: { form: CLOSED_MESSAGE } };
  }

  // Refuses to record a payment against details that are no longer published.
  // Step one may have been passed while payment was switched on; if an admin
  // has since turned it off, writing SUBMITTED here would claim money had been
  // sent to an account nobody is watching.
  if (!isPaymentConfigured(paymentConfig)) {
    return {
      status: "error",
      errors: {
        form: "Payment is not currently open. Please try again shortly, or contact the organizing committee.",
      },
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

  // The upload has already happened, so a failure from here on leaves a file in
  // the store with nothing pointing at it. Cleaning up on the way out keeps the
  // bucket in step with the table; the removal is best-effort by design, and
  // must not replace the real error with a storage one.
  let registration;
  try {
    registration = await createRegistration({
      ...team,
      payment: {
        reference,
        amount,
        screenshotUrl: stored.url,
        screenshotKey: stored.key,
      },
    });
  } catch (error) {
    await removePhoto(stored.key);
    throw error;
  }

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
