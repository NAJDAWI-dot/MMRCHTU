import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { parseStatus } from "@/lib/competition-day";

const LINKS = [
  { href: "/game", label: "Pac Mouse" },
  { href: "/rules", label: "Rules" },
  { href: "/schedule", label: "Schedule" },
  { href: "/competition-day", label: "Competition Day" },
  { href: "/gallery", label: "Gallery" },
  { href: "/faq", label: "FAQ" },
  { href: "/register", label: "Register" },
];

/**
 * Hrefs to leave out of the menu, so it never points at a 404 or a dead end.
 *
 * Competition Day goes while that page's status is HIDDEN. Gallery goes until
 * at least one album is published with a photo in it — an empty gallery is a
 * wasted click. Admin saves call revalidatePath("/", "layout") to pick either
 * change up.
 */
async function hiddenHrefs(): Promise<Set<string>> {
  const [config, publishedAlbums] = await Promise.all([
    prisma.competitionDayConfig.findUnique({ where: { id: "singleton" } }),
    prisma.galleryAlbum.count({ where: { isPublished: true, photos: { some: {} } } }),
  ]);

  const hidden = new Set<string>();
  // No row yet means the schema defaults apply, and the default is not HIDDEN.
  if (parseStatus(config?.status) === "HIDDEN") hidden.add("/competition-day");
  if (publishedAlbums === 0) hidden.add("/gallery");
  return hidden;
}

export async function Nav() {
  const hidden = await hiddenHrefs();

  return (
    <nav aria-label="Primary" className="flex items-center gap-6">
      {LINKS.filter((link) => !hidden.has(link.href)).map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="text-sm font-medium text-ras-gray transition-colors hover:text-ras-purple dark:text-white/80 dark:hover:text-white"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
