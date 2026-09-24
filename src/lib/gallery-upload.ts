import "server-only";
import { prisma } from "@/lib/prisma";
import { storePhoto } from "@/lib/photo-storage";
import { CAPTION_MAX, SNIFF_BYTES, checkUpload, sniffImageType, storageKey } from "@/lib/gallery";

export interface UploadResult {
  added: number;
  errors: string[];
}

/**
 * Stores the files posted as "photos" in an album, after its last photo.
 *
 * Each file is validated, stored, and recorded independently: one bad file in
 * a selection of thirty should not lose the other twenty-nine, so failures are
 * collected and reported rather than thrown. The caller checks the admin's
 * role and clears whichever pages show the album.
 *
 * Shared by the gallery admin and the day's Photos desk, so both reach the
 * store under the same rules.
 */
export async function addPhotos(album: { id: string; slug: string }, formData: FormData): Promise<UploadResult> {
  const albumId = album.id;
  const files = formData.getAll("photos").filter((f): f is File => f instanceof File);
  if (files.length === 0) return { added: 0, errors: ["No files were selected."] };

  const last = await prisma.galleryPhoto.findFirst({
    where: { albumId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  let nextOrder = (last?.sortOrder ?? -1) + 1;

  // One optional caption for the batch: the Photos desk sends it, the gallery
  // admin captions photo by photo afterwards and sends none.
  const caption = String(formData.get("caption") ?? "").trim().slice(0, CAPTION_MAX);
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
          caption,
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

  return { added, errors };
}
