import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getCompetitionDayConfig } from "@/lib/site-config";

export interface DayPhoto {
  id: string;
  url: string;
  caption: string;
  width: number | null;
  height: number | null;
  createdAt: Date;
}

export interface DayPhotos {
  album: { id: string; title: string; slug: string; isPublished: boolean } | null;
  /** Newest first: this is a live feed, not an arranged album. */
  photos: DayPhoto[];
  count: number;
}

/**
 * The day album the Photos desk uploads into, for the day site, the hall
 * screen and the desk itself. The album does not have to be published in the
 * main gallery: on the day site it is covered by the day site's own access
 * setting, and the gallery can list it afterwards.
 */
export const loadDayPhotos = cache(async (take: number = 120): Promise<DayPhotos> => {
  const config = await getCompetitionDayConfig();
  if (!config.dayAlbumId) return { album: null, photos: [], count: 0 };

  const album = await prisma.galleryAlbum.findUnique({
    where: { id: config.dayAlbumId },
    select: { id: true, title: true, slug: true, isPublished: true },
  });
  if (!album) return { album: null, photos: [], count: 0 };

  const [photos, count] = await Promise.all([
    prisma.galleryPhoto.findMany({
      where: { albumId: album.id },
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, url: true, caption: true, width: true, height: true, createdAt: true },
    }),
    prisma.galleryPhoto.count({ where: { albumId: album.id } }),
  ]);
  return { album, photos, count };
});
