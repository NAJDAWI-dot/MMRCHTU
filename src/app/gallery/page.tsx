import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { sortAlbums } from "@/lib/gallery";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gallery",
  description: "Photos from MMRC 26 — the Micro Mouse Robot Competition and the build-up to it.",
};

export default async function GalleryPage() {
  // Published albums with at least one photo. An empty album on the public
  // site is a dead end, so it stays hidden until there is something to see.
  const albums = await prisma.galleryAlbum.findMany({
    where: { isPublished: true, photos: { some: {} } },
    include: {
      _count: { select: { photos: true } },
      photos: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], take: 1 },
    },
  });
  const ordered = sortAlbums(albums);

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="font-display text-3xl font-extrabold text-ras-purple dark:text-white">
        Gallery
      </h1>
      <p className="mt-3 max-w-2xl text-ras-gray dark:text-white/70">
        Photos from the competition and everything leading up to it.
      </p>

      {ordered.length === 0 ? (
        <Card className="mt-10 text-center">
          <p className="text-lg font-medium text-ras-purple dark:text-white">
            No photos up yet
          </p>
          <p className="mt-2 text-sm text-ras-gray dark:text-white/60">
            They will appear here after the first event. In the meantime, the{" "}
            <Link href="/schedule" className="font-semibold text-ras-crimson hover:underline">
              schedule
            </Link>{" "}
            has what is coming.
          </p>
        </Card>
      ) : (
        <ul className="stagger mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {ordered.map((album) => {
            const cover = album.photos[0];
            return (
              <li key={album.id}>
                <Link
                  href={`/gallery/${album.slug}`}
                  className="group block overflow-hidden rounded-lg border border-ras-gray/20 bg-[var(--color-surface)] shadow-sm transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ras-purple"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-ras-purple/10">
                    {cover && (
                      <Image
                        src={cover.url}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    )}
                  </div>
                  <div className="p-4">
                    <p className="font-display font-bold text-ras-purple dark:text-white">
                      {album.title}
                    </p>
                    <p className="mt-1 text-xs text-ras-gray dark:text-white/60">
                      {album.eventDate
                        ? album.eventDate.toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })
                        : null}
                      {album.eventDate ? " · " : ""}
                      {album._count.photos} photo{album._count.photos === 1 ? "" : "s"}
                    </p>
                    {album.description && (
                      <p className="mt-2 line-clamp-2 text-sm text-ras-gray dark:text-white/70">
                        {album.description}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
