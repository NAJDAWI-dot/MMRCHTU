import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { downloadUrlFor } from "@/lib/photo-storage";
import { PhotoGrid } from "./PhotoGrid";

export const dynamic = "force-dynamic";

async function getAlbum(slug: string) {
  return prisma.galleryAlbum.findFirst({
    where: { slug, isPublished: true },
    include: { photos: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
  });
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const album = await getAlbum(params.slug);
  if (!album) return { title: "Album not found" };

  return {
    title: album.title,
    description: album.description || `Photos from ${album.title}.`,
    openGraph: {
      title: album.title,
      description: album.description || `Photos from ${album.title}.`,
      // The cover doubles as the share image, so a link to an album previews
      // as the album rather than as the site's default card.
      images: album.photos[0] ? [{ url: album.photos[0].url }] : undefined,
    },
  };
}

export default async function AlbumPage({ params }: { params: { slug: string } }) {
  const album = await getAlbum(params.slug);
  // An unpublished or empty album is a 404 rather than an empty page: it is
  // not something a visitor can do anything with, and it should not be
  // discoverable before it is ready.
  if (!album || album.photos.length === 0) notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <Link href="/gallery" className="text-sm font-semibold text-ras-crimson hover:underline">
        ← All albums
      </Link>

      <h1 className="mt-3 font-display text-3xl font-extrabold text-ras-purple dark:text-white">
        {album.title}
      </h1>
      <p className="mt-2 text-sm text-ras-gray dark:text-white/60">
        {album.eventDate
          ? album.eventDate.toLocaleDateString(undefined, {
              day: "numeric",
              month: "long",
              year: "numeric",
            })
          : null}
        {album.eventDate ? " · " : ""}
        {album.photos.length} photo{album.photos.length === 1 ? "" : "s"}
      </p>
      {album.description && (
        <p className="mt-4 max-w-2xl leading-relaxed text-ras-gray dark:text-white/70">
          {album.description}
        </p>
      )}

      <PhotoGrid
        albumTitle={album.title}
        photos={album.photos.map((photo) => ({
          id: photo.id,
          url: photo.url,
          downloadUrl: downloadUrlFor(photo.url),
          caption: photo.caption,
          width: photo.width,
          height: photo.height,
        }))}
      />
    </div>
  );
}
