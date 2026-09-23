import type { Metadata } from "next";
import { PhotoGrid } from "@/app/gallery/[slug]/PhotoGrid";
import { Empty, PageHead } from "@/components/day-site/ui";
import { requireDayViewer } from "@/lib/day-access";
import { loadDayPhotos } from "@/lib/day-photos";
import { downloadUrlFor } from "@/lib/photo-storage";

export const revalidate = 30;
export const metadata: Metadata = { title: "Photos" };

/**
 * The day's photos as they are taken, newest first. The same grid and
 * lightbox as the gallery, so every photo opens large and can be saved.
 */
export default async function DayPhotosPage() {
  await requireDayViewer();
  const { album, photos, count } = await loadDayPhotos();

  return (
    <div className="space-y-4">
      <PageHead
        kicker="From the hall"
        title="Photos"
        lead={`Taken on the day and put up as they come in, newest first.${count > photos.length ? ` The latest ${photos.length} of ${count}.` : ""}`}
      />
      {album && photos.length ? (
        <PhotoGrid
          albumTitle={album.title}
          photos={photos.map((photo) => ({
            id: photo.id,
            url: photo.url,
            downloadUrl: downloadUrlFor(photo.url),
            caption: photo.caption,
            width: photo.width,
            height: photo.height,
          }))}
        />
      ) : (
        <div className="pt-8">
          <Empty icon="camera" title="No photos yet">
            The first pictures from the hall show up here as soon as they are taken.
          </Empty>
        </div>
      )}
    </div>
  );
}
