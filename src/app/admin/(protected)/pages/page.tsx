import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { parseStatus } from "@/lib/competition-day";
import { MANAGED_PAGES } from "@/lib/pages";
import { setPageHidden } from "./actions";

export const metadata: Metadata = {
  title: "Admin — Pages",
};

/**
 * Reasons a page is already missing from the menu that have nothing to do with
 * the switches on this screen.
 *
 * Shown because otherwise this page tells an outright lie: Gallery reads
 * "Visible" here while no album is published, and an admin who checks the site
 * and finds no Gallery link concludes the switch is broken.
 */
async function otherReasons(): Promise<Map<string, string>> {
  const [dayConfig, publishedAlbums] = await Promise.all([
    prisma.competitionDayConfig.findUnique({ where: { id: "singleton" } }),
    prisma.galleryAlbum.count({ where: { isPublished: true, photos: { some: {} } } }),
  ]);

  const reasons = new Map<string, string>();
  if (parseStatus(dayConfig?.status) === "HIDDEN") {
    reasons.set(
      "/competition-day",
      "Also hidden by its status on the Competition Day tab, which is set to Hidden.",
    );
  }
  if (publishedAlbums === 0) {
    reasons.set(
      "/gallery",
      "Also out of the menu on its own, because no album is published with photos in it yet.",
    );
  }
  return reasons;
}

export default async function AdminPagesPage() {
  const [rows, reasons] = await Promise.all([
    prisma.pageVisibility.findMany({ select: { href: true, isHidden: true } }),
    otherReasons(),
  ]);

  // Absent means visible, so this only has to record the exceptions.
  const hiddenHrefs = new Set(rows.filter((row) => row.isHidden).map((row) => row.href));

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold text-ras-purple dark:text-white">Pages</h1>
      <p className="mt-2 max-w-2xl text-sm text-ras-gray dark:text-white/70">
        Hiding a page takes it out of the site menu and makes it return &ldquo;not found&rdquo; to
        visitors, along with everything underneath it. Nothing is deleted — un-hiding puts the page
        back exactly as it was. While you are signed in here you can still open a hidden page
        directly by its address, so you can check it before showing it to anyone.
      </p>

      <div className="mt-6 space-y-4">
        {MANAGED_PAGES.map((page) => {
          const isHidden = hiddenHrefs.has(page.href);
          const reason = reasons.get(page.href);

          return (
            <Card key={page.href}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-lg font-bold text-ras-purple dark:text-white">
                      {page.label}
                    </h2>
                    <span
                      className={
                        isHidden
                          ? "rounded-full bg-ras-crimson/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-ras-crimson dark:bg-mood-rose/20 dark:text-mood-rose"
                          : "rounded-full bg-ras-purple/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-ras-purple dark:bg-white/10 dark:text-white/80"
                      }
                    >
                      {isHidden ? "Hidden" : "Visible"}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-xs text-ras-gray dark:text-white/60">
                    {page.href}
                  </p>
                  <p className="mt-2 text-sm text-ras-gray dark:text-white/70">{page.covers}</p>
                  {reason ? (
                    <p className="mt-2 rounded-md bg-ras-purple/5 p-2 text-xs text-ras-gray dark:bg-white/5 dark:text-white/70">
                      {reason}
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  {/*
                    Opens in a new tab, so checking a page does not navigate the
                    admin out of the list they are working through.
                  */}
                  <Link
                    href={page.href}
                    target="_blank"
                    rel="noreferrer"
                    className="-mx-2 inline-flex min-h-[44px] items-center rounded-md px-2 text-sm font-semibold text-ras-crimson hover:underline dark:text-mood-rose"
                  >
                    Open ↗
                  </Link>
                  <form action={setPageHidden}>
                    <input type="hidden" name="href" value={page.href} />
                    {/* The state being moved to, not the state it is in. */}
                    <input type="hidden" name="isHidden" value={isHidden ? "false" : "true"} />
                    <Button type="submit" variant={isHidden ? "primary" : "ghost"}>
                      {isHidden ? "Show page" : "Hide page"}
                    </Button>
                  </form>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <p className="mt-6 max-w-2xl text-xs text-ras-gray dark:text-white/60">
        The homepage is not on this list on purpose: hiding it would leave visitors on a
        &ldquo;not found&rdquo; page with no menu to get anywhere else.
      </p>
    </div>
  );
}
