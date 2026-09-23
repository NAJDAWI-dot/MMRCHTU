"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { removePhoto } from "@/lib/photo-storage";
import { reorder, uniqueSlug } from "@/lib/gallery";
import { addPhotos, type UploadResult } from "@/lib/gallery-upload";
import { requireSection } from "@/lib/admin-access";

function toDate(value: FormDataEntryValue | null): Date | null {
  const str = String(value ?? "");
  if (!str) return null;
  const date = new Date(str);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Public gallery pages plus the admin screens that list the same data. */
function revalidateGallery(slug?: string) {
  revalidatePath("/gallery");
  if (slug) revalidatePath(`/gallery/${slug}`);
  revalidatePath("/admin/gallery");
  // The header hides the Gallery link while nothing is published.
  revalidatePath("/", "layout");
}

export async function createAlbum(formData: FormData) {
  await requireSection("/admin/gallery");

  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("An album title is required.");

  const taken = (await prisma.galleryAlbum.findMany({ select: { slug: true } })).map((a) => a.slug);

  await prisma.galleryAlbum.create({
    data: {
      title,
      slug: uniqueSlug(title, taken),
      description: String(formData.get("description") ?? "").trim(),
      eventDate: toDate(formData.get("eventDate")),
      sortOrder: Number(formData.get("sortOrder") ?? 0),
    },
  });

  revalidateGallery();
}

export async function updateAlbum(formData: FormData) {
  await requireSection("/admin/gallery");

  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!id || !title) throw new Error("Missing album id or title.");

  const existing = await prisma.galleryAlbum.findUnique({ where: { id } });
  if (!existing) throw new Error("That album no longer exists.");

  // The slug only follows the title while the album is unpublished. Once it is
  // public the URL has been shared, and silently moving it would break every
  // link already out there.
  let slug = existing.slug;
  if (!existing.isPublished && title !== existing.title) {
    const taken = (
      await prisma.galleryAlbum.findMany({ where: { NOT: { id } }, select: { slug: true } })
    ).map((a) => a.slug);
    slug = uniqueSlug(title, taken);
  }

  await prisma.galleryAlbum.update({
    where: { id },
    data: {
      title,
      slug,
      description: String(formData.get("description") ?? "").trim(),
      eventDate: toDate(formData.get("eventDate")),
      sortOrder: Number(formData.get("sortOrder") ?? 0),
      isPublished: formData.get("isPublished") === "on",
    },
  });

  revalidateGallery(existing.slug);
  if (slug !== existing.slug) revalidateGallery(slug);
}

export async function deleteAlbum(formData: FormData) {
  await requireSection("/admin/gallery");

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing album id.");

  const album = await prisma.galleryAlbum.findUnique({
    where: { id },
    include: { photos: { select: { storageKey: true } } },
  });
  if (!album) return;

  // Files first: the rows are the only record of which files exist, so
  // deleting them first would strand every image in the store with nothing
  // left pointing at it. A failed file delete is logged, not fatal.
  for (const photo of album.photos) {
    const result = await removePhoto(photo.storageKey);
    if (!result.ok) console.error(`gallery: could not delete ${photo.storageKey}: ${result.error}`);
  }

  // Photo rows go with the album via onDelete: Cascade.
  await prisma.galleryAlbum.delete({ where: { id } });

  revalidateGallery(album.slug);
}

/** Uploads one or more images into an album. See addPhotos for the rules. */
export async function uploadPhotos(formData: FormData): Promise<UploadResult> {
  await requireSection("/admin/gallery");

  const albumId = String(formData.get("albumId") ?? "");
  if (!albumId) throw new Error("Missing album id.");

  const album = await prisma.galleryAlbum.findUnique({ where: { id: albumId } });
  if (!album) throw new Error("That album no longer exists.");

  const result = await addPhotos(album, formData);
  revalidateGallery(album.slug);
  return result;
}

export async function updatePhotoCaption(formData: FormData) {
  await requireSection("/admin/gallery");

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing photo id.");

  const photo = await prisma.galleryPhoto.update({
    where: { id },
    data: { caption: String(formData.get("caption") ?? "").trim() },
    include: { album: { select: { slug: true } } },
  });

  revalidateGallery(photo.album.slug);
}

export async function deletePhoto(formData: FormData) {
  await requireSection("/admin/gallery");

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing photo id.");

  const photo = await prisma.galleryPhoto.findUnique({
    where: { id },
    include: { album: { select: { slug: true } } },
  });
  if (!photo) return;

  const result = await removePhoto(photo.storageKey);
  if (!result.ok) console.error(`gallery: could not delete ${photo.storageKey}: ${result.error}`);

  await prisma.galleryPhoto.delete({ where: { id } });
  revalidateGallery(photo.album.slug);
}

/**
 * Moves a photo one place earlier or later.
 *
 * The whole album is renumbered rather than two rows being swapped: swapping
 * leaves gaps and duplicate sortOrder values, and once those exist the display
 * order quietly starts depending on insertion order instead.
 */
export async function movePhoto(formData: FormData) {
  await requireSection("/admin/gallery");

  const id = String(formData.get("id") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (!id) throw new Error("Missing photo id.");

  const photo = await prisma.galleryPhoto.findUnique({
    where: { id },
    include: { album: { select: { id: true, slug: true } } },
  });
  if (!photo) return;

  const photos = await prisma.galleryPhoto.findMany({
    where: { albumId: photo.album.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });

  const from = photos.findIndex((p) => p.id === id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from === -1 || to < 0 || to >= photos.length) return;

  const moved = reorder(photos, from, to);

  await prisma.$transaction(
    moved.map((p, index) =>
      prisma.galleryPhoto.update({ where: { id: p.id }, data: { sortOrder: index } }),
    ),
  );

  revalidateGallery(photo.album.slug);
}
