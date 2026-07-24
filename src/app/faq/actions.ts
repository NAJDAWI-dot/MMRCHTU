"use server";

import { createFaqQuestion, validateFaqQuestion, type FaqQuestionFieldErrors } from "@/lib/faq";

export interface AskQuestionActionState {
  status: "idle" | "success" | "error";
  errors?: FaqQuestionFieldErrors;
}

export async function submitFaqQuestion(
  _prevState: AskQuestionActionState,
  formData: FormData,
): Promise<AskQuestionActionState> {
  const input = {
    question: String(formData.get("question") ?? ""),
    askerEmail: String(formData.get("askerEmail") ?? "") || undefined,
  };

  const errors = validateFaqQuestion(input);
  if (Object.keys(errors).length > 0) {
    return { status: "error", errors };
  }

  await createFaqQuestion(input);
  return { status: "success" };
}
