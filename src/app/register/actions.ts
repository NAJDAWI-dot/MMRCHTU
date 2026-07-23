"use server";

import { createRegistration, validateRegistration, type FieldErrors } from "@/lib/registration";

export interface RegisterActionState {
  status: "idle" | "success" | "error";
  errors?: FieldErrors;
}

export async function registerTeam(
  _prevState: RegisterActionState,
  formData: FormData
): Promise<RegisterActionState> {
  const input = {
    teamName: String(formData.get("teamName") ?? ""),
    contactName: String(formData.get("contactName") ?? ""),
    email: String(formData.get("email") ?? ""),
    memberCount: Number(formData.get("memberCount") ?? 1),
  };

  const errors = validateRegistration(input);
  if (Object.keys(errors).length > 0) {
    return { status: "error", errors };
  }

  await createRegistration(input);
  return { status: "success" };
}
