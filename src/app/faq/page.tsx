import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { AskQuestionForm } from "@/app/faq/AskQuestionForm";

export const dynamic = "force-dynamic";

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
      <div className="prose prose-headings:font-display prose-headings:text-ras-purple dark:prose-invert mt-8 max-w-none">
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
