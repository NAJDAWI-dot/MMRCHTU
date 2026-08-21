import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { rulebookSections, type SearchDoc } from "@/lib/search";

/**
 * Assembles the searchable corpus.
 *
 * Separate from `search.ts` because this half touches the filesystem and the
 * database, and that is exactly what the ranking half must not do if it is to
 * stay testable. Nothing here is pure; everything there is.
 */
export async function searchCorpus(): Promise<SearchDoc[]> {
  const [rulebook, faqs] = await Promise.all([
    // Read as text rather than imported as MDX: this wants the prose, and the
    // compiled module is a React component with the words locked inside it.
    readFile(path.join(process.cwd(), "content/rules/rulebook.mdx"), "utf8").catch(() => ""),
    prisma.faqEntry.findMany({
      where: { isPublished: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, question: true, answer: true },
    }),
  ]);

  return [
    ...rulebookSections(rulebook),
    ...faqs.map(
      (entry): SearchDoc => ({
        id: `faq-${entry.id}`,
        title: entry.question,
        body: entry.answer,
        href: "/faq",
        kind: "faq",
      }),
    ),
  ];
}
