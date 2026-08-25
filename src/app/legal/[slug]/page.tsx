import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LEGAL_PAGES, isLegalSlug, loadLegalPage, type LegalSlug } from "@/lib/mdx";

// Static prose that changes a handful of times a year.
export const revalidate = 3600;

export function generateStaticParams(): { slug: LegalSlug }[] {
  return (Object.keys(LEGAL_PAGES) as LegalSlug[]).map((slug) => ({ slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  if (!isLegalSlug(params.slug)) return { title: "Not found" };
  return {
    title: LEGAL_PAGES[params.slug],
    description: `${LEGAL_PAGES[params.slug]} for MMRC 26, the Maze Solver Robot Competition.`,
  };
}

export default async function LegalPage({ params }: { params: { slug: string } }) {
  if (!isLegalSlug(params.slug)) notFound();

  const Body = await loadLegalPage(params.slug);
  const others = (Object.keys(LEGAL_PAGES) as LegalSlug[]).filter((slug) => slug !== params.slug);

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-3xl font-extrabold text-ras-purple dark:text-white">
        {LEGAL_PAGES[params.slug]}
      </h1>

      <div className="prose prose-headings:font-display prose-headings:text-ras-purple dark:prose-invert mt-8 max-w-none">
        <Body />
      </div>

      <nav aria-label="Other policies" className="mt-12 border-t border-ras-gray/15 pt-6">
        <p className="text-xs uppercase tracking-widest text-ras-gray dark:text-white/60">
          Also worth reading
        </p>
        <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {others.map((slug) => (
            <li key={slug}>
              <Link
                href={`/legal/${slug}`}
                className="font-semibold text-ras-purple underline dark:text-white"
              >
                {LEGAL_PAGES[slug]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
