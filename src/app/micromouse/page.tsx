import type { Metadata } from "next";
import Link from "next/link";
import { loadMicromouseGuide } from "@/lib/mdx";
import { RULES } from "@/lib/rules";
import { MATCH_SECONDS, narrowestGapMm } from "@/lib/micromouse";

export const metadata: Metadata = {
  title: "Micro Mouse",
  description:
    "How to build a micromouse for MMRC 26: sizing a chassis to the maze, motors and sensors, wall following, flood fill, and how the score formula decides your strategy.",
};

/**
 * The build guide.
 *
 * Deliberately not a general introduction to micromouse. There is plenty of
 * that on the internet and most of it is written for a 16x16 maze, a different
 * scoring formula and a centre that is not an island. Every section here is
 * about this competition's maze and this competition's rules, and the three
 * diagrams run on the same code the rules page uses, so the guide cannot
 * quietly drift away from what the judges will be holding.
 */
export default async function MicromousePage() {
  const Guide = await loadMicromouseGuide();

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ras-crimson dark:text-[#ff9b9b]">
        The technical guide
      </p>
      <h1 className="mt-2 font-display text-4xl font-extrabold text-ras-purple dark:text-white">
        Building a micromouse
      </h1>
      <p className="mt-3 text-base leading-relaxed text-ras-gray dark:text-white/75">
        Everything we can tell you about getting a robot round our maze on its own: what the
        rulebook costs your design, what to build, what to write, and how to spend the eight
        minutes when you get there. Written for this competition, not for micromouse in general.
        Take the shell off the mouse and pull the robot underneath apart, drag it round a corridor
        to see what its sensors see, knock walls down and watch the maze re-solve itself.
      </p>

      {/* The three numbers that decide the most, before anybody scrolls. */}
      <dl className="mt-6 grid grid-cols-3 gap-3 text-center">
        <Fact term="The maze" value={`${RULES.mazeGrid}x${RULES.mazeGrid}`} note={`${RULES.cellSizeCm}cm cells`} />
        <Fact term="Room to drive" value={`${narrowestGapMm()}mm`} note="at its narrowest" />
        <Fact term="Your match" value={`${MATCH_SECONDS / 60} min`} note="runs and resets" />
      </dl>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/rules"
          className="inline-flex min-h-[44px] items-center rounded-full bg-ras-purple px-5 text-sm font-semibold text-white transition-colors hover:bg-mood-plum"
        >
          Read the rules first
        </Link>
        <Link
          href="/register"
          className="inline-flex min-h-[44px] items-center rounded-full border border-ras-purple/40 px-5 text-sm font-semibold text-ras-purple transition-transform active:scale-95 dark:border-white/30 dark:text-white"
        >
          Register a team
        </Link>
      </div>

      {/*
        Ahead of the guide rather than at the foot of it.

        The page is specific on purpose, down to part numbers and a robot drawn
        at real size, and specific reads as prescribed. A team that turns up
        with four sensors and a different microcontroller has not broken
        anything, and should not find that out only if they scroll to the end.
      */}
      <aside className="mt-8 rounded-2xl border border-ras-crimson/30 bg-[var(--color-surface)] p-4 shadow-sm sm:p-5 dark:border-[#ff9b9b]/30">
        <h2 className="font-display text-base font-extrabold text-ras-crimson dark:text-[#ff9b9b]">
          This is an example, not a specification
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ras-gray dark:text-white/75">
          The rulebook is the only thing you have to follow. Everything on this page is one way of
          building a mouse that satisfies it, and it is a sensible first build rather than the
          fastest or the only one. Use different motors, a different number of sensors, a different
          microcontroller or a different algorithm, and you are still competing exactly as
          intended. Where this page and the{" "}
          <Link href="/rules" className="font-semibold text-accent hover:underline">
            rulebook
          </Link>{" "}
          disagree, the rulebook wins.
        </p>
      </aside>

      <div className="prose prose-headings:font-display prose-headings:text-ras-purple dark:prose-invert dark:prose-headings:text-white mt-10 max-w-none">
        <Guide />
      </div>

      <p className="mt-10 border-t border-ras-gray/15 pt-6 text-sm text-ras-gray dark:text-white/70">
        Stuck on something this page does not cover?{" "}
        <Link href="/faq" className="font-semibold text-accent hover:underline">
          Check the FAQ
        </Link>{" "}
        or ask{" "}
        <Link href="/team" className="font-semibold text-accent hover:underline">
          the committee
        </Link>
        .
      </p>
    </div>
  );
}

function Fact({ term, value, note }: { term: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-ras-purple/20 bg-[var(--color-surface)] px-2 py-3 dark:border-white/15">
      <dt className="text-[10px] uppercase tracking-widest text-ras-gray dark:text-white/55">
        {term}
      </dt>
      <dd>
        <span className="block font-display text-xl font-extrabold text-ras-purple dark:text-white">
          {value}
        </span>
        <span className="block text-[11px] text-ras-gray dark:text-white/55">{note}</span>
      </dd>
    </div>
  );
}
