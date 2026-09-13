import type { Metadata } from "next";
import Link from "next/link";
import manifestJson from "../../../../public/rulebook/manifest.json";
import { FlipBook } from "@/components/rulebook/FlipBook";
import { type RulebookManifest, toClientManifest } from "@/lib/rulebook-book";

export const metadata: Metadata = {
  title: "3D Rulebook",
  description:
    "The MMRC26 Official Rulebook & Contest Manual as a book you can page through, with live diagrams of the maze, the two run types, the score formula and a robot footprint checker bound in beside the rules they explain.",
};

const manifest = manifestJson as RulebookManifest;

export default function RulebookBookPage() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:py-10">
      <div className="mx-auto max-w-3xl text-center">
        <Link
          href="/rules"
          className="inline-flex min-h-[44px] items-center text-sm font-semibold text-accent hover:underline"
        >
          &larr; Back to the classic rulebook
        </Link>
        <h1 className="font-display text-3xl font-extrabold text-ras-purple dark:text-white">
          3D Rulebook
        </h1>
        <p className="mt-2 text-sm text-ras-gray sm:text-base dark:text-white/70">
          The Official Rulebook &amp; Contest Manual, page for page. The pages marked with an{" "}
          <strong className="text-ras-purple dark:text-white">A</strong> are interactive: re-roll a
          maze, race a search run against a speed run, check your chassis and work out what a run is
          worth.
        </p>
      </div>

      <div className="mt-6">
        <FlipBook manifest={toClientManifest(manifest)} />
      </div>

      <div className="mx-auto mt-10 max-w-3xl border-t border-ras-gray/15 pt-6">
        <p className="text-sm text-ras-gray dark:text-white/70">
          Read it all?{" "}
          <Link href="/rules/checklist" className="font-semibold text-accent hover:underline">
            Check your team against it
          </Link>{" "}
          before competition day.
        </p>

        {/* The same words as the page images, as text: for screen readers,
            for search engines, and for anyone who would rather not turn pages. */}
        <details className="group mt-6 rounded-lg border border-ras-gray/20 bg-[var(--color-surface)]">
          <summary className="flex min-h-[44px] cursor-pointer items-center px-4 text-sm font-semibold text-ras-purple dark:text-white">
            Read the rulebook as plain text
          </summary>
          <div className="space-y-6 px-4 pb-6">
            {manifest.pages.slice(1).map((page) => (
              <section key={page.number} aria-label={`Page ${page.number}`}>
                <h2 className="font-display text-xs font-bold uppercase tracking-wide text-ras-gray dark:text-white/60">
                  Page {page.number}
                </h2>
                <div className="mt-2 text-sm leading-relaxed text-ras-gray dark:text-white/80">
                  {page.lines
                    .filter(
                      (line) =>
                        !/^(HTU Micromouse Contest 2026|Official Contest Manual|\d+)$/.test(
                          line.text,
                        ),
                    )
                    .map((line, i) => (
                      <span
                        key={i}
                        className={`block ${line.size >= 14 ? "mt-3 font-semibold text-ras-purple dark:text-white" : ""}`}
                      >
                        {line.text}
                      </span>
                    ))}
                </div>
              </section>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}
