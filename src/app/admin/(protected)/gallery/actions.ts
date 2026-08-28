"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { removePhoto, storePhoto } from "@/lib/photo-storage";
import {
  SNIFF_BYTES,
  checkUpload,
  reorder,
  sniffImageType,
  storageKey,
  uniqueSlug,
} from "@/lib/gallery";

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
  await requireAdmin();

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
  await requireAdmin();

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
  await requireAdmin();

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

export interface UploadResult {
  added: number;
  errors: string[];
}

/**
 * Uploads one or more images into an album.
 *
 * Each file is validated, stored, and recorded independently: one bad file in
 * a selection of thirty should not lose the other twenty-nine, so failures are
 * collected and reported rather than thrown.
 */
export async function uploadPhotos(formData: FormData): Promise<UploadResult> {
  await requireAdmin();

  const albumId = String(formData.get("albumId") ?? "");
  if (!albumId) throw new Error("Missing album id.");

  const album = await prisma.galleryAlbum.findUnique({ where: { id: albumId } });
  if (!album) throw new Error("That album no longer exists.");

  const files = formData.getAll("photos").filter((f): f is File => f instanceof File);
  if (files.length === 0) return { added: 0, errors: ["No files were selected."] };

  const last = await prisma.galleryPhoto.findFirst({
    where: { albumId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  let nextOrder = (last?.sortOrder ?? -1) + 1;

  const errors: string[] = [];
  let added = 0;

  for (const [index, file] of files.entries()) {
    const problem = checkUpload({ name: file.name, type: file.type, size: file.size });
    if (problem) {
      errors.push(`${file.name}: ${problem}`);
      continue;
    }

    // Same byte check the public payment upload does. This one is behind an
    // admin login so the threat is far smaller, but both paths reach the same
    // storage under the same rules, and having them agree is what stops the
    // safer of the two quietly becoming the way in.
    const head = new Uint8Array(await file.slice(0, SNIFF_BYTES).arrayBuffer());
    const imageType = sniffImageType(head);
    if (!imageType) {
      errors.push(`${file.name}: not a JPEG, PNG, WebP or AVIF image.`);
      continue;
    }

    try {
      // Unique without needing a round trip: the album is fixed, and no two
      // files in one submission can share both index and timestamp.
      const unique = `${Date.now().toString(36)}-${index}`;
      const key = storageKey(album.slug, imageType, unique);
      const stored = await storePhoto(key, file, imageType);

      await prisma.galleryPhoto.create({
        data: {
          albumId,
          url: stored.url,
          storageKey: stored.key,
          caption: "",
          width: Number(formData.get(`width-${index}`)) || null,
          height: Number(formData.get(`height-${index}`)) || null,
          sortOrder: nextOrder++,
        },
      });
      added++;
    } catch (error) {
      errors.push(`${file.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  revalidateGallery(album.slug);
  return { added, errors };
}

export async function updatePhotoCaption(formData: FormData) {
  await requireAdmin();

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
  await requireAdmin();

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
  await requireAdmin();

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
