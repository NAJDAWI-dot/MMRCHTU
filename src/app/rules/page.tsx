import type { Metadata } from "next";
import { loadRulebook } from "@/lib/mdx";

export const metadata: Metadata = {
  title: "Rules",
  description: "The official MMRC 26 rulebook.",
};

export default async function RulesPage() {
  const Rulebook = await loadRulebook();

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-3xl font-extrabold text-ras-purple dark:text-white">
        Rulebook
      </h1>
      <div className="prose prose-headings:font-display prose-headings:text-ras-purple dark:prose-invert mt-8 max-w-none">
        <Rulebook />
      </div>
    </div>
  );
}
