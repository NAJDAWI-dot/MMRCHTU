import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { isStorageConfigured } from "@/lib/photo-storage";
import { sortAlbums } from "@/lib/gallery";
import { createAlbum } from "./actions";

export const metadata: Metadata = {
  title: "Gallery",
};

const FIELD =
  "mt-1 w-full rounded-md border border-ras-gray/30 bg-transparent px-3 py-2 text-sm text-ras-purple placeholder:text-ras-gray/60 dark:text-white dark:placeholder:text-white/40";

export default async function AdminGalleryPage() {
  const albums = await prisma.galleryAlbum.findMany({
    include: { _count: { select: { photos: true } } },
  });
  const ordered = sortAlbums(albums);
  const storageReady = isStorageConfigured();

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold text-ras-purple dark:text-white">
        Gallery
      </h1>
      <p className="mt-2 text-sm text-ras-gray dark:text-white/70">
        One album per event. Albums stay hidden from the public site until you publish them, so you
        can upload and reorder in peace.
      </p>

      {!storageReady && (
        <Card className="mt-6 border-ras-crimson/40">
          <p className="text-sm font-semibold text-ras-crimson">
            This deployment cannot see <code className="font-mono text-xs">BLOB_READ_WRITE_TOKEN</code>
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ras-gray dark:text-white/70">
            <li>Create a Blob store: Vercel dashboard → Storage → Create → Blob.</li>
            <li>Connect it to this project (Storage → your store → Projects).</li>
            <li>
              <strong>Redeploy.</strong> Vercel captures environment variables when a deployment is
              built, so a store created afterwards stays invisible to the deployment already running
              — this is the step that is usually missed.
            </li>
          </ol>
          <p className="mt-2 text-sm text-ras-gray dark:text-white/70">
            Uploading is not blocked by this notice. Try it and the error, if any, will say what
            actually went wrong.
          </p>
        </Card>
      )}

      <Card className="mt-6">
        <h2 className="font-display text-base font-bold text-ras-purple dark:text-white">
          New album
        </h2>
        <form action={createAlbum} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">
            <span className="font-medium text-ras-gray dark:text-white/80">Title</span>
            <input name="title" required placeholder="MMRC 26 Finals" className={FIELD} />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="font-medium text-ras-gray dark:text-white/80">Description</span>
            <textarea
              name="description"
              rows={2}
              placeholder="What happened, in a sentence or two."
              className={FIELD}
            />
          </label>
          <label className="text-sm">
            <span className="font-medium text-ras-gray dark:text-white/80">Event date</span>
            <input type="date" name="eventDate" className={FIELD} />
          </label>
          <label className="text-sm">
            <span className="font-medium text-ras-gray dark:text-white/80">Sort order</span>
            <input type="number" name="sortOrder" defaultValue={0} className={FIELD} />
          </label>
          <div className="sm:col-span-2">
            <Button type="submit">Create album</Button>
          </div>
        </form>
      </Card>

      <div className="mt-6 flex flex-col gap-3">
        {ordered.length === 0 ? (
          <Card>
            <p className="text-sm text-ras-gray dark:text-white/70">
              No albums yet. Create one above, then add photos to it.
            </p>
          </Card>
        ) : (
          ordered.map((album) => (
            <Card key={album.id} className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-display font-bold text-ras-purple dark:text-white">
                    {album.title}
                  </p>
                  {album.isPublished ? (
                    <Badge>Published</Badge>
                  ) : (
                    <span className="rounded-full border border-ras-gray/30 px-2 py-0.5 text-xs text-ras-gray dark:text-white/60">
                      Hidden
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-ras-gray dark:text-white/60">
                  {album._count.photos} photo{album._count.photos === 1 ? "" : "s"}
                  {album.eventDate ? ` · ${album.eventDate.toLocaleDateString()}` : ""}
                  {" · /gallery/"}
                  {album.slug}
                </p>
              </div>
              <Button asChild variant="ghost">
                <Link href={`/admin/gallery/${album.id}`}>Manage</Link>
              </Button>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
