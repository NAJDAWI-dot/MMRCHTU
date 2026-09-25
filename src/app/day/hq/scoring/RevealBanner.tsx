import Link from "next/link";
import { DayIcon } from "@/components/day-site/icons";
import { heldBackLines, revealOf } from "@/lib/reveal";
import { getCompetitionDayConfig } from "@/lib/site-config";

/** On the scoring desks: what the public cannot see yet, and where to change it. */
export async function RevealBanner({ phases }: { phases: readonly number[] }) {
  const lines = heldBackLines(revealOf(await getCompetitionDayConfig()), phases);
  if (!lines.length) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[4px] bg-day-gold/10 px-4 py-3 ring-1 ring-day-gold/30" role="note">
      <p className="flex items-start gap-2.5 text-sm text-day-ink">
        <DayIcon name="lock" className="mt-0.5 h-4 w-4 shrink-0 text-day-gold" />
        <span>
          <span className="font-semibold">Held back from the public.</span> {lines.join(" ")} You still see everything here.
        </span>
      </p>
      <Link href="/day/hq/scoring/reveal" className="day-btn day-btn-soft day-btn-sm">
        <DayIcon name="eye" className="h-4 w-4" />
        Reveal
      </Link>
    </div>
  );
}
