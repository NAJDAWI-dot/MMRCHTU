"use server";

import { requireSection } from "@/lib/admin-access";
import { refreshDaySite } from "@/lib/day-refresh";
import { SNIFF_BYTES, checkUpload, reorder, sniffImageType } from "@/lib/gallery";
import { removePhoto, storePhoto } from "@/lib/photo-storage";
import { prisma } from "@/lib/prisma";
import { logoKey, sponsorFields } from "@/lib/sponsors";
import type { DeskState } from "../state";

const SECTION = "/day/hq/sponsors";

type StoredLogo = { ok: true; url: string; key: string } | { ok: false; message: string } | null;

/**
 * Stores the logo posted as "logo", under the same checks as a gallery photo:
 * a size cap, and the file's own bytes deciding its type, never its name.
 * Null when no file was chosen.
 */
async function storeLogo(name: string, value: FormDataEntryValue | null): Promise<StoredLogo> {
  if (!(value instanceof File) || value.size === 0) return null;
  const problem = checkUpload({ name: value.name, type: value.type, size: value.size });
  if (problem) return { ok: false, message: `The logo: ${problem}` };
  const imageType = sniffImageType(new Uint8Array(await value.slice(0, SNIFF_BYTES).arrayBuffer()));
  if (!imageType) return { ok: false, message: "The logo has to be a PNG, WebP, JPEG or AVIF image." };
  try {
    const stored = await storePhoto(logoKey(name, imageType, Date.now().toString(36)), value, imageType);
    return { ok: true, url: stored.url, key: stored.key };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

async function dropLogo(key: string) {
  const removed = await removePhoto(key);
  if (!removed.ok) console.error(`sponsors: could not delete ${key}: ${removed.error}`);
}

export async function addSponsor(_previous: DeskState, formData: FormData): Promise<DeskState> {
  await requireSection(SECTION);
  const fields = sponsorFields(formData);
  if (!fields.ok) return fields;

  const logo = await storeLogo(fields.name, formData.get("logo"));
  if (logo && !logo.ok) return logo;

  const last = await prisma.sponsor.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  await prisma.sponsor.create({
    data: {
      name: fields.name,
      tier: fields.tier,
      website: fields.website,
      logoUrl: logo?.url ?? "",
      logoKey: logo?.key ?? "",
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });
  refreshDaySite();
  return { ok: true, message: `${fields.name} is on the sponsors slide.` };
}

export async function saveSponsor(_previous: DeskState, formData: FormData): Promise<DeskState> {
  await requireSection(SECTION);
  const sponsor = await prisma.sponsor.findUnique({ where: { id: String(formData.get("id") ?? "") } });
  if (!sponsor) return { ok: false, message: "That sponsor is already gone." };
  const fields = sponsorFields(formData);
  if (!fields.ok) return fields;

  const logo = await storeLogo(fields.name, formData.get("logo"));
  if (logo && !logo.ok) return logo;
  const removing = !logo && formData.get("removeLogo") === "on";

  await prisma.sponsor.update({
    where: { id: sponsor.id },
    data: {
      name: fields.name,
      tier: fields.tier,
      website: fields.website,
      isPublished: formData.get("isPublished") === "on",
      ...(logo ? { logoUrl: logo.url, logoKey: logo.key } : removing ? { logoUrl: "", logoKey: "" } : {}),
    },
  });
  // The old file goes once nothing points at it any more.
  if ((logo || removing) && sponsor.logoKey) await dropLogo(sponsor.logoKey);
  refreshDaySite();
  return { ok: true, message: "Saved." };
}

export async function deleteSponsor(_previous: DeskState, formData: FormData): Promise<DeskState> {
  await requireSection(SECTION);
  const sponsor = await prisma.sponsor.findUnique({ where: { id: String(formData.get("id") ?? "") } });
  if (!sponsor) return { ok: true, message: "Already gone." };
  if (sponsor.logoKey) await dropLogo(sponsor.logoKey);
  await prisma.sponsor.delete({ where: { id: sponsor.id } });
  refreshDaySite();
  return { ok: true, message: `${sponsor.name} is off the list.` };
}

/** One place earlier or later; the whole list is renumbered so the order never has gaps or ties. */
export async function moveSponsor(_previous: DeskState, formData: FormData): Promise<DeskState> {
  await requireSection(SECTION);
  const id = String(formData.get("id") ?? "");
  const sponsors = await prisma.sponsor.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true } });
  const from = sponsors.findIndex((sponsor) => sponsor.id === id);
  const to = formData.get("direction") === "up" ? from - 1 : from + 1;
  if (from === -1 || to < 0 || to >= sponsors.length) return { ok: false, message: "It is already at the end." };
  await prisma.$transaction(reorder(sponsors, from, to).map((sponsor, index) => prisma.sponsor.update({ where: { id: sponsor.id }, data: { sortOrder: index } })));
  refreshDaySite();
  return { ok: true, message: "Moved." };
}
