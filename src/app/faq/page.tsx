import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { AskQuestionForm } from "@/app/faq/AskQuestionForm";
import { SearchBox } from "@/app/search/SearchBox";

// Static prose that changes a handful of times a year, and every admin save
// revalidates it. Serving it from cache saves a database round trip per
// visitor.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "FAQ",
  description: "Frequently asked questions about MMRC 26.",
};

export default async function FaqPage() {
  const entries = await prisma.faqEntry.findMany({
    where: { isPublished: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-3xl font-extrabold text-ras-purple dark:text-white">
        Frequently asked questions
      </h1>
      {/* The page people land on when they have a question, so the place a
          search box earns its space. */}
      <div className="mt-6">
        <SearchBox />
      </div>

      <div className="stagger prose prose-headings:font-display prose-headings:text-ras-purple dark:prose-invert mt-8 max-w-none">
        {entries.map((entry) => (
          <div key={entry.id}>
            <h2>{entry.question}</h2>
            <p>{entry.answer}</p>
          </div>
        ))}
      </div>
      <div className="mt-10">
        <AskQuestionForm />
      </div>
    </div>
  );
}
