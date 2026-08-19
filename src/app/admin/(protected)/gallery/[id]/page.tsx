import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { isStorageConfigured } from "@/lib/photo-storage";
import { PhotoUploader } from "../PhotoUploader";
import { deleteAlbum, deletePhoto, movePhoto, updateAlbum, updatePhotoCaption } from "../actions";

export const metadata: Metadata = {
  title: "Manage album",
};

const FIELD =
  "mt-1 w-full rounded-md border border-ras-gray/30 bg-transparent px-3 py-2 text-sm text-ras-purple placeholder:text-ras-gray/60 dark:text-white dark:placeholder:text-white/40";

/** yyyy-mm-dd for a date input, in local time. */
function dateValue(date: Date | null): string {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export default async function AlbumPage({ params }: { params: { id: string } }) {
  const album = await prisma.galleryAlbum.findUnique({
    where: { id: params.id },
    include: { photos: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
  });
  if (!album) notFound();

  const storageReady = isStorageConfigured();

  return (
    <div>
      <Link href="/admin/gallery" className="text-sm font-semibold text-ras-crimson hover:underline">
        ← All albums
      </Link>
      <h1 className="mt-2 font-display text-2xl font-extrabold text-ras-purple dark:text-white">
        {album.title}
      </h1>
      <p className="mt-1 text-sm text-ras-gray dark:text-white/60">
        {album.isPublished ? (
          <>
            Live at{" "}
            <Link href={`/gallery/${album.slug}`} className="font-semibold text-ras-crimson hover:underline">
              /gallery/{album.slug}
            </Link>
          </>
        ) : (
          <>Hidden from the public site. Publish it below when it is ready.</>
        )}
      </p>

      <Card className="mt-6">
        <h2 className="font-display text-base font-bold text-ras-purple dark:text-white">Details</h2>
        <form action={updateAlbum} className="mt-4 grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="id" value={album.id} />
          <label className="text-sm sm:col-span-2">
            <span className="font-medium text-ras-gray dark:text-white/80">Title</span>
            <input name="title" required defaultValue={album.title} className={FIELD} />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="font-medium text-ras-gray dark:text-white/80">Description</span>
            <textarea name="description" rows={3} defaultValue={album.description} className={FIELD} />
          </label>
          <label className="text-sm">
            <span className="font-medium text-ras-gray dark:text-white/80">Event date</span>
            <input type="date" name="eventDate" defaultValue={dateValue(album.eventDate)} className={FIELD} />
          </label>
          <label className="text-sm">
            <span className="font-medium text-ras-gray dark:text-white/80">Sort order</span>
            <input type="number" name="sortOrder" defaultValue={album.sortOrder} className={FIELD} />
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="isPublished" defaultChecked={album.isPublished} className="h-4 w-4" />
            <span className="font-medium text-ras-gray dark:text-white/80">
              Published — visible on the public site
            </span>
          </label>
          <div className="sm:col-span-2">
            <Button type="submit">Save details</Button>
          </div>
        </form>
        {!album.isPublished && (
          <p className="mt-3 text-xs text-ras-gray dark:text-white/50">
            While hidden, renaming the album also changes its URL. Once published the URL is fixed,
            so links you have already shared keep working.
          </p>
        )}
      </Card>

      <Card className="mt-6">
        <h2 className="font-display text-base font-bold text-ras-purple dark:text-white">
          Add photos
        </h2>
        <div className="mt-4">
          {storageReady ? (
            <PhotoUploader albumId={album.id} />
          ) : (
            <p className="text-sm text-ras-crimson">
              Uploads need a Vercel Blob store. Create one in Storage → Create → Blob, then redeploy.
            </p>
          )}
        </div>
      </Card>

      <h2 className="mt-8 font-display text-base font-bold text-ras-purple dark:text-white">
        Photos ({album.photos.length})
      </h2>
      {album.photos.length === 0 ? (
        <Card className="mt-3">
          <p className="text-sm text-ras-gray dark:text-white/70">
            No photos yet. The album will stay off the public gallery until it has at least one.
          </p>
        </Card>
      ) : (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {album.photos.map((photo, index) => (
            <li key={photo.id}>
              <Card className="flex gap-4">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md bg-ras-purple/10">
                  <Image
                    src={photo.url}
                    alt={photo.caption || "Gallery photo"}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <form action={updatePhotoCaption} className="flex flex-col gap-2">
                    <input type="hidden" name="id" value={photo.id} />
                    <label className="text-xs font-medium text-ras-gray dark:text-white/70">
                      Caption
                      <input
                        name="caption"
                        defaultValue={photo.caption}
                        placeholder="Optional"
                        className={FIELD}
                      />
                    </label>
                    <Button type="submit" variant="ghost" className="self-start px-3 py-1 text-xs">
                      Save caption
                    </Button>
                  </form>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <form action={movePhoto}>
                      <input type="hidden" name="id" value={photo.id} />
                      <input type="hidden" name="direction" value="up" />
                      <button
                        type="submit"
                        disabled={index === 0}
                        className="rounded border border-ras-gray/30 px-2 py-1 text-xs text-ras-gray disabled:opacity-30 dark:text-white/70"
                      >
                        ↑ Earlier
                      </button>
                    </form>
                    <form action={movePhoto}>
                      <input type="hidden" name="id" value={photo.id} />
                      <input type="hidden" name="direction" value="down" />
                      <button
                        type="submit"
                        disabled={index === album.photos.length - 1}
                        className="rounded border border-ras-gray/30 px-2 py-1 text-xs text-ras-gray disabled:opacity-30 dark:text-white/70"
                      >
                        ↓ Later
                      </button>
                    </form>
                    <form action={deletePhoto}>
                      <input type="hidden" name="id" value={photo.id} />
                      <button type="submit" className="rounded px-2 py-1 text-xs font-semibold text-ras-crimson hover:bg-ras-crimson/10">
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Card className="mt-8 border-ras-crimson/30">
        <h2 className="font-display text-base font-bold text-ras-crimson">Delete this album</h2>
        <p className="mt-2 text-sm text-ras-gray dark:text-white/70">
          Removes the album and all {album.photos.length} of its photos, including the stored image
          files. This cannot be undone.
        </p>
        <form action={deleteAlbum} className="mt-4">
          <input type="hidden" name="id" value={album.id} />
          <Button type="submit" variant="secondary">
            Delete album
          </Button>
        </form>
      </Card>
    </div>
  );
}
