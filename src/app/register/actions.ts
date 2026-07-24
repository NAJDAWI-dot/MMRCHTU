"use server";

import {
  createRegistration,
  validateRegistration,
  hasFieldErrors,
  type FieldErrors,
  type IeeeStatus,
  type TeamMemberInput,
} from "@/lib/registration";

export interface RegisterActionState {
  status: "idle" | "success" | "error";
  errors?: FieldErrors;
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

  const errors = validateRegistration(input);
  if (hasFieldErrors(errors)) {
    return { status: "error", errors };
  }

  await createRegistration(input);
  return { status: "success" };
}
