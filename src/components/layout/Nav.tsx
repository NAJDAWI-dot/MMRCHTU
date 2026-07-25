import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { parseStatus } from "@/lib/competition-day";

const LINKS = [
  { href: "/game", label: "Pac Mouse" },
  { href: "/rules", label: "Rules" },
  { href: "/schedule", label: "Schedule" },
  { href: "/competition-day", label: "Competition Day" },
  { href: "/faq", label: "FAQ" },
  { href: "/register", label: "Register" },
];

/**
 * Hrefs to leave out of the menu. The Competition Day link is dropped while that
 * page's status is HIDDEN so the menu never points at a 404; admin saves call
 * revalidatePath("/", "layout") to pick the change up.
 */
async function hiddenHrefs(): Promise<Set<string>> {
  const config = await prisma.competitionDayConfig.findUnique({ where: { id: "singleton" } });
  // No row yet means the schema defaults apply, and the default is not HIDDEN.
  return parseStatus(config?.status) === "HIDDEN" ? new Set(["/competition-day"]) : new Set<string>();
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
