import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { parseStatus } from "@/lib/competition-day";
import { absoluteUrl } from "@/lib/site-url";
import { getCompetitionDayConfig } from "@/lib/site-config";
import { LEGAL_PAGES } from "@/lib/mdx";

/**
 * Rebuilt hourly rather than per request. Crawlers do not need the minute a
 * gallery album went up, and a sitemap that hits the database on every hit is
 * a free denial-of-service button.
 */
export const revalidate = 3600;

/**
 * Only what a visitor can actually reach.
 *
 * Admin pages and API routes are excluded here and disallowed in robots.ts —
 * listing a page that redirects to a login screen wastes crawl budget and puts
 * the shape of the admin area in a public file.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [albums, config] = await Promise.all([
    prisma.galleryAlbum.findMany({
      where: { isPublished: true, photos: { some: {} } },
      select: { slug: true, updatedAt: true },
    }),
    getCompetitionDayConfig(),
  ]);

  const now = new Date();

  const entries: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/rules"), lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: absoluteUrl("/rules/checklist"), lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: absoluteUrl("/schedule"), lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: absoluteUrl("/register"), lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: absoluteUrl("/faq"), lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: absoluteUrl("/game"), lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];

  // Listed rather than left out: a visitor deciding whether to pay a fee is
  // entitled to find the refund policy through a search engine, not only
  // through the footer of the page that took their money.
  for (const slug of Object.keys(LEGAL_PAGES)) {
    entries.push({
      url: absoluteUrl(`/legal/${slug}`),
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    });
  }

  // Both of these hide themselves when there is nothing behind them, so a
  // sitemap that always listed them would advertise 404s.
  if (parseStatus(config.status) !== "HIDDEN") {
    entries.push({
      url: absoluteUrl("/competition-day"),
      lastModified: config.updatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  if (albums.length > 0) {
    entries.push({
      url: absoluteUrl("/gallery"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    });
    for (const album of albums) {
      entries.push({
        url: absoluteUrl(`/gallery/${album.slug}`),
        lastModified: album.updatedAt,
        changeFrequency: "yearly",
        priority: 0.4,
      });
    }
  }

  return entries;
}
