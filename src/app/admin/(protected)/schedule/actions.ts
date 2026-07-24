"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function toDate(value: FormDataEntryValue | null): Date | null {
  const str = String(value ?? "");
  if (!str) return null;
  const date = new Date(str);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function createEvent(formData: FormData) {
  await requireAdmin();

  const startsAt = toDate(formData.get("startsAt"));
  if (!startsAt) throw new Error("A valid start date/time is required.");

  await prisma.scheduleEvent.create({
    data: {
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      startsAt,
      endsAt: toDate(formData.get("endsAt")),
      location: String(formData.get("location") ?? "") || null,
      sortOrder: Number(formData.get("sortOrder") ?? 0),
    },
  });

  revalidatePath("/schedule");
  revalidatePath("/admin/schedule");
}

export async function updateEvent(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const startsAt = toDate(formData.get("startsAt"));
  if (!id || !startsAt) throw new Error("Missing event id or a valid start date/time.");

  await prisma.scheduleEvent.update({
    where: { id },
    data: {
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      startsAt,
      endsAt: toDate(formData.get("endsAt")),
      location: String(formData.get("location") ?? "") || null,
      sortOrder: Number(formData.get("sortOrder") ?? 0),
    },
  });

  revalidatePath("/schedule");
  revalidatePath("/admin/schedule");
}

export async function deleteEvent(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing event id.");

  await prisma.scheduleEvent.delete({ where: { id } });

  revalidatePath("/schedule");
  revalidatePath("/admin/schedule");
}
