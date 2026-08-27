import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { parseStatus } from "@/lib/competition-day";
import { hiddenPageHrefs } from "@/lib/page-visibility";
import { MobileNav } from "@/components/layout/MobileNav";

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
 * Three separate reasons, unioned. A page an admin switched off on the Pages
 * tab goes, and so does anything hiding itself: Competition Day while that
 * page's status is HIDDEN, and Gallery until at least one album is published
 * with a photo in it, since an empty gallery is a wasted click. Admin saves
 * call revalidatePath("/", "layout") to pick any of them up.
 *
 * The menu is filtered for admins too. A link the admin has just hidden should
 * not still be sitting in the menu they are looking at — and the page itself
 * stays reachable by URL for them, which is where previewing it belongs.
 */
async function hiddenHrefs(): Promise<Set<string>> {
  const [config, publishedAlbums, adminHidden] = await Promise.all([
    prisma.competitionDayConfig.findUnique({ where: { id: "singleton" } }),
    prisma.galleryAlbum.count({ where: { isPublished: true, photos: { some: {} } } }),
    hiddenPageHrefs(),
  ]);

  const hidden = new Set<string>(adminHidden);
  // No row yet means the schema defaults apply, and the default is not HIDDEN.
  if (parseStatus(config?.status) === "HIDDEN") hidden.add("/competition-day");
  if (publishedAlbums === 0) hidden.add("/gallery");
  return hidden;
}

/**
 * Renders both menus from one list.
 *
 * The row of links and the phone menu have to agree about which pages exist,
 * including the ones hidden while unpublished — so the filtering happens once,
 * here, and both are handed the result. Two separate copies of this list would
 * drift the first time a link was added to one of them.
 */
export async function Nav() {
  const hidden = await hiddenHrefs();
  const links = LINKS.filter((link) => !hidden.has(link.href));

  return (
    <>
      <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            // The underline wipes in from the left rather than appearing whole,
            // which is the difference between the menu reacting to the pointer
            // and merely recolouring under it.
            className="relative text-sm font-medium text-ras-gray transition-colors after:absolute after:inset-x-0 after:-bottom-1 after:h-px after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-200 hover:text-ras-purple hover:after:scale-x-100 motion-reduce:after:transition-none dark:text-white/80 dark:hover:text-white"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <MobileNav links={links} />
    </>
  );
}
