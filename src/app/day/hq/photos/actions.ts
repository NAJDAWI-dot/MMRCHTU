"use server";

import { revalidatePath } from "next/cache";
import { requireSection } from "@/lib/admin-access";
import { refreshDaySite } from "@/lib/day-refresh";
import { uniqueSlug } from "@/lib/gallery";
import { addPhotos, type UploadResult } from "@/lib/gallery-upload";
import { removePhoto } from "@/lib/photo-storage";
import { prisma } from "@/lib/prisma";
import { getCompetitionDayConfig } from "@/lib/site-config";
import type { DeskState } from "../state";

const SECTION = "/day/hq/photos";

/** Everywhere the day's photos show, in the day site and in the gallery. */
function refreshPhotos(slug: string) {
  refreshDaySite();
  revalidatePath("/gallery");
  revalidatePath(`/gallery/${slug}`);
  revalidatePath("/admin/gallery");
}

async function dayAlbum() {
  const config = await getCompetitionDayConfig();
  if (!config.dayAlbumId) return null;
  return prisma.galleryAlbum.findUnique({ where: { id: config.dayAlbumId } });
}

/**
 * Makes the album the day's photos go into. It starts unpublished in the main
 * gallery, like every album, so the day site and the hall screen are the only
 * places it shows until someone publishes it there.
 */
export async function startDayAlbum(_previous: DeskState, formData: FormData): Promise<DeskState> {
  await requireSection(SECTION);
  if (await dayAlbum()) return { ok: true, message: "The day album is already started." };

  const config = await getCompetitionDayConfig();
  const title = String(formData.get("title") ?? "").trim().slice(0, 120) || "MMRC 26 Competition Day";
  const taken = (await prisma.galleryAlbum.findMany({ select: { slug: true } })).map((album) => album.slug);
  const album = await prisma.galleryAlbum.create({
    data: {
      title,
      slug: uniqueSlug(title, taken),
      description: "Photos from the hall, taken on the day.",
      eventDate: config.eventDate,
    },
  });
  await prisma.competitionDayConfig.upsert({
    where: { id: "singleton" },
    update: { dayAlbumId: album.id },
    create: { id: "singleton", dayAlbumId: album.id },
  });
  refreshPhotos(album.slug);
  return { ok: true, message: `Started "${title}". Photos you add go straight to the day site and the hall screen.` };
}

export async function uploadDayPhotos(formData: FormData): Promise<UploadResult> {
  await requireSection(SECTION);
  const album = await dayAlbum();
  if (!album) return { added: 0, errors: ["Start the day album first."] };

  const result = await addPhotos(album, formData);
  refreshPhotos(album.slug);
  return result;
}

/** Takes one photo off the day site, the screen and the album, and out of storage. */
export async function takeDownPhoto(_previous: DeskState, formData: FormData): Promise<DeskState> {
  await requireSection(SECTION);
  const album = await dayAlbum();
  const photo = await prisma.galleryPhoto.findUnique({ where: { id: String(formData.get("id") ?? "") } });
  // Only the day album's photos: this desk is not a way into every album.
  if (!album || !photo || photo.albumId !== album.id) return { ok: false, message: "That photo is already gone." };

  const removed = await removePhoto(photo.storageKey);
  if (!removed.ok) console.error(`day photos: could not delete ${photo.storageKey}: ${removed.error}`);
  await prisma.galleryPhoto.delete({ where: { id: photo.id } });
  refreshPhotos(album.slug);
  return { ok: true, message: "Taken down." };
}
