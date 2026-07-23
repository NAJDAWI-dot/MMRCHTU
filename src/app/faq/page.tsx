import type { Metadata } from "next";
import { loadFaq } from "@/lib/mdx";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Frequently asked questions about MMRC 26.",
};

export default async function FaqPage() {
  const Faq = await loadFaq();

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-3xl font-extrabold text-ras-purple dark:text-white">
        Frequently asked questions
      </h1>
      <div className="prose prose-headings:font-display prose-headings:text-ras-purple dark:prose-invert mt-8 max-w-none">
        <Faq />
      </div>
    </div>
  );
}
