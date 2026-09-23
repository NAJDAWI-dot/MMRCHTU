import { MAX_IMAGE_EDGE, fitWithin } from "@/lib/gallery";

/**
 * Shrinks a photo in the browser before it is uploaded.
 *
 * A modern phone photo is 4-12 MB and 4000px wide; nothing on the site shows
 * it above ~1200px, so uploading the original wastes storage once and
 * bandwidth on every view afterwards. Resizing here means the expensive copy
 * never leaves the device. Dimensions are measured on the way so the pages can
 * reserve the right space and not jump as images load.
 *
 * Shared by the gallery admin and the day's Photos desk.
 */

/** Re-encode quality. High enough to look clean, low enough to matter. */
const JPEG_QUALITY = 0.85;

export interface PreparedPhoto {
  file: File;
  width: number;
  height: number;
  originalSize: number;
}

/** Draws the image at its capped size and re-encodes it. */
/**
 * `forceJpeg` re-encodes even when that comes out larger: for a format the
 * site cannot serve, such as the HEIC an iPhone may hand over, which the
 * browser can often decode but the store will not take.
 */
export async function shrinkPhoto(file: File, { forceJpeg = false }: { forceJpeg?: boolean } = {}): Promise<PreparedPhoto> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_IMAGE_EDGE);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    // No canvas means no resize; send the original rather than nothing.
    return { file, width: bitmap.width, height: bitmap.height, originalSize: file.size };
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob) return { file, width, height, originalSize: file.size };

  // Keep the original if re-encoding somehow made it bigger — true for small
  // PNG screenshots and already-optimised images.
  if (!forceJpeg && blob.size >= file.size) {
    return { file, width, height, originalSize: file.size };
  }

  const renamed = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return {
    file: new File([blob], renamed, { type: "image/jpeg" }),
    width,
    height,
    originalSize: file.size,
  };
}
