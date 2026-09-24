import Link from "next/link";
import { DayIcon } from "@/components/day-site/icons";
import { FINAL_ROUND, phaseInfo } from "@/lib/bracket";
import type { LastReveal } from "@/lib/reveal";

/** What a reveal is called on the day site, and where to see it. */
export function revealedLink(last: LastReveal): { text: string; href: string } {
  if (last.phase === "all") return { text: "All the results", href: "/day/standings" };
  const name = phaseInfo(last.phase).name;
  if (last.phase === FINAL_ROUND && last.kind === "advance") return { text: "The champions", href: "/day" };
  if (last.phase === 1) return last.kind === "advance" ? { text: "Who qualified, and the draw", href: "/day/bracket" } : { text: "The qualifying results", href: "/day/standings" };
  return last.kind === "advance" ? { text: `Who went through from the ${name}`, href: "/day/bracket" } : { text: `The ${name} results`, href: "/day/bracket" };
}

/** A gold strip under the header for ten minutes after the organisers reveal results. */
export function JustRevealed({ last }: { last: LastReveal | null }) {
  if (!last) return null;
  const { text, href } = revealedLink(last);
  return (
    <div className="relative z-30 overflow-hidden border-b border-day-gold/30 bg-day-gold/[0.12]" role="status">
      <div className="day-banner-in mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <p className="flex items-center gap-2.5 text-sm font-semibold text-day-ink">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-day-gold text-day-on-ink">
            <DayIcon name="trophy" className="h-4 w-4" />
          </span>
          <span>
            <span className="font-bold text-day-gold">Just revealed</span> · {text}
          </span>
        </p>
        <Link href={href} className="day-btn day-btn-ink day-btn-sm">
          See them
          <DayIcon name="arrow" className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
