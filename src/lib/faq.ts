import { prisma } from "@/lib/prisma";
import { sendAdminNotification } from "@/lib/email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface FaqQuestionInput {
  question: string;
  askerEmail?: string;
}

export interface FaqQuestionFieldErrors {
  question?: string;
  askerEmail?: string;
}

export function validateFaqQuestion(input: Partial<FaqQuestionInput>): FaqQuestionFieldErrors {
  const errors: FaqQuestionFieldErrors = {};

  if (!input.question || input.question.trim().length < 5) {
    errors.question = "Question must be at least 5 characters.";
  }
  if (input.askerEmail && !EMAIL_RE.test(input.askerEmail)) {
    errors.askerEmail = "Enter a valid email address, or leave it blank.";
  }

  return errors;
}

export async function createFaqQuestion(input: FaqQuestionInput) {
  const question = await prisma.faqQuestion.create({
    data: {
      question: input.question.trim(),
      askerEmail: input.askerEmail?.trim() || null,
    },
  });

  await sendAdminNotification({ question: question.question, askerEmail: question.askerEmail });

  return question;
}
