import Link from "next/link";
import { EarlyBirdBadge } from "@/components/promo/EarlyBirdBadge";
import { MouseMark } from "@/components/brand/MouseMark";

import { prisma } from "@/lib/prisma";
import { parseStatus } from "@/lib/competition-day";
import { hiddenPageHrefs } from "@/lib/page-visibility";
import { MobileNav } from "@/components/layout/MobileNav";
import { getEarlyBirdState } from "@/lib/early-bird-server";

const LINKS = [
  { href: "/game", label: "Pac Mouse" },
  { href: "/rules", label: "Rules" },
  { href: "/schedule", label: "Schedule" },
  { href: "/competition-day", label: "Competition Day" },
  { href: "/gallery", label: "Gallery" },
  // Marked special so it renders as a pill rather than another plain link:
  // the committee page is the one page about people rather than about the
  // competition, and it was disappearing among six siblings that all look
  // alike.
  { href: "/team", label: "Team", special: true },
  { href: "/faq", label: "FAQ" },
  { href: "/register", label: "Register" },
];

/**
 * Hrefs to leave out of the menu, so it never points at a 404 or a dead end.
 *
 * Three separate reasons, unioned. A page an admin switched off on the Pages
 * tab goes, and so does anything hiding itself: Competition Day while that
 * page's status is HIDDEN, and Gallery until at least one album is published
 * with a photo in it, since an empty gallery is a wasted click.
 *
 * Team is deliberately not in that group. An empty committee page says so in
 * a sentence and is a reasonable thing to land on, and hiding the link until
 * the first person is published meant the menu item nobody could find was
 * also the one nobody could use to check their work. Admin saves
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
  // One read for both menus, and cached for the rest of the request, so the
  // hero on the landing page does not ask the same question again.
  const earlyBird = await getEarlyBirdState();

  return (
    <>
      <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
        {links.map((link) =>
          link.special ? (
            /*
              A pill rather than a link. It carries the brand gradient, a mouse,
              and the only lift-on-hover in the menu, so it reads as an
              invitation among six labels that all look the same.
            */
            <Link
              key={link.href}
              href={link.href}
              className="group inline-flex items-center gap-1.5 rounded-full border border-ras-purple/30 bg-gradient-to-r from-ras-purple/15 via-ras-crimson/10 to-ras-purple/15 px-3 py-1.5 text-sm font-semibold text-ras-purple shadow-sm transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-px hover:border-ras-purple/55 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:border-white/25 dark:from-white/12 dark:via-white/5 dark:to-white/12 dark:text-white dark:hover:border-white/45"
            >
              <MouseMark className="h-4 w-4 opacity-80 transition-transform duration-200 group-hover:-rotate-6 motion-reduce:transition-none motion-reduce:group-hover:rotate-0" />
              {link.label}
            </Link>
          ) : (
            <Link
              key={link.href}
              href={link.href}
              // The underline wipes in from the left rather than appearing whole,
              // which is the difference between the menu reacting to the pointer
              // and merely recolouring under it.
              className="relative text-sm font-medium text-ras-gray transition-colors after:absolute after:inset-x-0 after:-bottom-1 after:h-px after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-200 hover:text-ras-purple hover:after:scale-x-100 motion-reduce:after:transition-none dark:text-white/80 dark:hover:text-white"
            >
              {link.label}
              {earlyBird.active && link.href === "/register" ? <EarlyBirdBadge /> : null}
            </Link>
          ),
        )}
      </nav>
      <MobileNav links={links} earlyBird={earlyBird.active} />
    </>
  );
}
