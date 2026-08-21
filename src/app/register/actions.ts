"use server";

import {
  createRegistration,
  validateRegistration,
  hasFieldErrors,
  type FieldErrors,
  type IeeeStatus,
  type TeamMemberInput,
} from "@/lib/registration";
import {
  hasPaymentErrors,
  validatePayment,
  type PaymentFieldErrors,
} from "@/lib/payment";

export interface RegisterActionState {
  status: "idle" | "success" | "error";
  errors?: FieldErrors;
  /**
   * Kept apart from `errors` because the payment report is optional as a whole
   * and validated on its own terms — mixing them would make a missing amount
   * look like a missing registration field.
   */
  paymentErrors?: PaymentFieldErrors;
  /** True when the team told us they have already transferred the fee. */
  paymentReported?: boolean;
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
    members: Array.from({ length: memberCount }, (_, i) => readMember(formData, i + 1)) as TeamMemberInput[],
  };

  const payment = {
    reference: String(formData.get("paymentReference") ?? ""),
    amount: String(formData.get("paymentAmount") ?? ""),
  };

  const errors = validateRegistration(input);
  const paymentErrors = validatePayment(payment);

  // Both are checked before returning, so a form with a problem in each shows
  // the reader everything at once rather than one error per attempt.
  if (hasFieldErrors(errors) || hasPaymentErrors(paymentErrors)) {
    return {
      status: "error",
      ...(hasFieldErrors(errors) ? { errors } : {}),
      ...(hasPaymentErrors(paymentErrors) ? { paymentErrors } : {}),
    };
  }

  await createRegistration({ ...input, payment });

  return {
    status: "success",
    paymentReported: Boolean(payment.reference.trim() && payment.amount.trim()),
  };
}
