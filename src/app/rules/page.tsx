import type { Metadata } from "next";
import Link from "next/link";
import { loadRulebook } from "@/lib/mdx";

export const metadata: Metadata = {
  title: "Rules",
  description:
    "The official MMRC 26 rulebook, with live diagrams of the maze, the two run types, and a robot footprint checker.",
};

export default async function RulesPage() {
  const Rulebook = await loadRulebook();

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-3xl font-extrabold text-ras-purple dark:text-white">
        Rulebook
      </h1>
      <p className="mt-3 text-ras-gray dark:text-white/70">
        The rules in full. The diagrams are live — re-roll the maze, compare the two run types,
        and check your chassis against the footprint limit.
      </p>
      <Link
        href="/rules/checklist"
        className="mt-4 inline-flex min-h-[44px] items-center rounded-md bg-ras-purple px-4 text-sm font-semibold text-white transition-colors hover:bg-mood-plum"
      >
        Run the readiness checklist
      </Link>

      <div className="prose prose-headings:font-display prose-headings:text-ras-purple dark:prose-invert dark:prose-headings:text-white mt-8 max-w-none">
        <Rulebook />
      </div>

      <p className="mt-10 border-t border-ras-gray/15 pt-6 text-sm text-ras-gray dark:text-white/70">
        Read it all?{" "}
        <Link href="/rules/checklist" className="font-semibold text-accent hover:underline">
          Check your team against it
        </Link>{" "}
        before competition day.
      </p>
    </div>
  );
}
