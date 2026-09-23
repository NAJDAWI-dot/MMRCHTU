"use server";

import { requireSection } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { refreshDaySite } from "@/lib/day-refresh";
import type { DeskState } from "../state";

const SECTION = "/day/hq/volunteers";

function fields(formData: FormData) {
  const text = (name: string, max: number) => String(formData.get(name) ?? "").trim().slice(0, max);
  return {
    name: text("name", 80),
    role: text("role", 80),
    station: text("station", 80),
    shift: text("shift", 60),
    phone: text("phone", 30),
    isPublished: formData.get("isPublished") === "on",
    sortOrder: Number(formData.get("sortOrder") ?? 0) || 0,
  };
}

export async function addVolunteer(_previous: DeskState, formData: FormData): Promise<DeskState> {
  await requireSection(SECTION);
  const data = fields(formData);
  if (!data.name) return { ok: false, message: "A volunteer needs a name." };
  await prisma.volunteer.create({ data });
  refreshDaySite();
  return { ok: true, message: `${data.name} added.` };
}

export async function updateVolunteer(_previous: DeskState, formData: FormData): Promise<DeskState> {
  await requireSection(SECTION);
  const id = String(formData.get("id") ?? "");
  const data = fields(formData);
  if (!data.name) return { ok: false, message: "A volunteer needs a name." };
  await prisma.volunteer.update({ where: { id }, data });
  refreshDaySite();
  return { ok: true, message: "Saved." };
}

export async function removeVolunteer(_previous: DeskState, formData: FormData): Promise<DeskState> {
  await requireSection(SECTION);
  await prisma.volunteer.deleteMany({ where: { id: String(formData.get("id") ?? "") } });
  refreshDaySite();
  return { ok: true, message: "Removed." };
}
