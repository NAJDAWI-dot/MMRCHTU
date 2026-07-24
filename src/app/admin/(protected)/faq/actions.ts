"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function createFaqEntry(formData: FormData) {
  await requireAdmin();

  await prisma.faqEntry.create({
    data: {
      question: String(formData.get("question") ?? ""),
      answer: String(formData.get("answer") ?? ""),
      sortOrder: Number(formData.get("sortOrder") ?? 0),
    },
  });

  revalidatePath("/faq");
  revalidatePath("/admin/faq");
}

export async function updateFaqEntry(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing FAQ entry id.");

  await prisma.faqEntry.update({
    where: { id },
    data: {
      question: String(formData.get("question") ?? ""),
      answer: String(formData.get("answer") ?? ""),
      sortOrder: Number(formData.get("sortOrder") ?? 0),
      isPublished: formData.get("isPublished") === "on",
    },
  });

  revalidatePath("/faq");
  revalidatePath("/admin/faq");
}

export async function deleteFaqEntry(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing FAQ entry id.");

  await prisma.faqEntry.delete({ where: { id } });

  revalidatePath("/faq");
  revalidatePath("/admin/faq");
}

export async function replyToQuestion(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const reply = String(formData.get("reply") ?? "");
  if (!id || !reply.trim()) throw new Error("Missing question id or reply text.");

  await prisma.faqQuestion.update({
    where: { id },
    data: { reply: reply.trim(), repliedAt: new Date(), status: "REPLIED" },
  });

  revalidatePath("/admin/faq");
}

export async function promoteQuestion(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing question id.");

  const question = await prisma.faqQuestion.findUnique({ where: { id } });
  if (!question || !question.reply) {
    throw new Error("Question must have a reply before it can be promoted.");
  }

  const maxSortOrder = await prisma.faqEntry.aggregate({ _max: { sortOrder: true } });

  await prisma.$transaction([
    prisma.faqEntry.create({
      data: {
        question: question.question,
        answer: question.reply,
        sortOrder: (maxSortOrder._max.sortOrder ?? -1) + 1,
      },
    }),
    prisma.faqQuestion.update({ where: { id }, data: { status: "PROMOTED" } }),
  ]);

  revalidatePath("/faq");
  revalidatePath("/admin/faq");
}
