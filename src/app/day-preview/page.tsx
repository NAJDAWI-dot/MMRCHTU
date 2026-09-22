import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DayHome } from "@/components/day/DayHome";
import { loadDaySite } from "@/lib/day-site";
import { dayModeOn, viewerIsAdmin } from "@/lib/page-visibility";

export const metadata: Metadata = {
  title: "Day mode preview",
  robots: { index: false, follow: false },
};

// Per viewer: it reads the session cookie, and must never be cached for one
// admin and served to the next visitor.
export const dynamic = "force-dynamic";

/**
 * The day site, for an admin, while the switch is still off.
 *
 * Its own route rather than a query string on the homepage: reading search
 * params would make the homepage render per request for every visitor, all
 * year, to serve a preview a handful of admins open a few times.
 *
 * Anyone else gets "not found", the same as a hidden page.
 */
export default async function DayPreviewPage() {
  if (!(await viewerIsAdmin())) notFound();

  const [data, on] = await Promise.all([loadDaySite(), dayModeOn()]);

  return (
    <>
      <div className="border-b border-[#F2A900]/50 bg-[#F2A900]/15 px-4 py-2.5 text-center text-sm text-[var(--color-fg)]">
        <strong>Preview.</strong>{" "}
        {on
          ? "Day mode is on, so this is what everyone sees at mmrchtu.tech right now."
          : "Day mode is off. Visitors still get the normal homepage."}{" "}
        <Link href="/admin/day-mode" className="font-semibold text-accent underline-offset-2 hover:underline">
          Back to Day Mode
        </Link>
      </div>
      <DayHome data={data} preview />
    </>
  );
}
