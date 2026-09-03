import type { Metadata } from "next";
import Link from "next/link";
import { highlight, search, tokenize } from "@/lib/search";
import { searchCorpus } from "@/lib/search-content";
import { SearchBox } from "@/app/search/SearchBox";
import { PageLink } from "@/components/layout/PageLink";

// The corpus is the rulebook file plus published FAQ entries, both of which
// change rarely and revalidate on admin save.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Search",
  description: "Search the MMRC 26 rulebook and FAQ.",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const query = (searchParams.q ?? "").trim();
  const terms = tokenize(query);
  // Skip the database and the filesystem entirely when there is nothing to
  // look for — an empty query is the most common way this page is reached.
  const hits = query ? search(await searchCorpus(), query) : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-3xl font-extrabold text-ras-purple dark:text-white">
        Search
      </h1>
      <p className="mt-3 text-ras-gray dark:text-white/70">
        Across the rulebook and the FAQ.
      </p>

      <div className="mt-6">
        <SearchBox initialQuery={query} autoFocus />
      </div>

      {query ? (
        <>
          <p className="mt-8 text-sm text-ras-gray dark:text-white/60" aria-live="polite">
            {hits.length === 0
              ? `Nothing matched “${query}”.`
              : `${hits.length} result${hits.length === 1 ? "" : "s"} for “${query}”.`}
          </p>

          {hits.length > 0 ? (
            <ul className="stagger mt-4 space-y-3">
              {hits.map((hit) => (
                <li key={hit.id}>
                  <Link
                    href={hit.href}
                    className="block rounded-lg border border-ras-gray/20 bg-[var(--color-surface)] p-4 transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-ras-purple/30 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h2 className="font-display font-bold text-ras-purple dark:text-white">
                        <Highlighted text={hit.title} terms={terms} />
                      </h2>
                      <span className="rounded-full bg-ras-purple/10 px-2 py-0.5 text-xs font-medium text-ras-purple dark:bg-white/10 dark:text-white/70">
                        {hit.kind === "rule" ? "Rulebook" : "FAQ"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-ras-gray dark:text-white/70">
                      <Highlighted text={hit.snippet} terms={terms} />
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 rounded-lg border border-ras-gray/20 bg-[var(--color-surface)] p-6 text-sm text-ras-gray dark:text-white/70">
              <p>
                Try a single word — <em>footprint</em>, <em>runs</em>, <em>eligibility</em>.
              </p>
              <p className="mt-3">
                Still stuck?{" "}
                <PageLink
                  href="/faq"
                  className="font-semibold text-accent hover:underline"
                >
                  Ask a question
                </PageLink>{" "}
                and the committee will answer it.
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="mt-8 rounded-lg border border-dashed border-ras-purple/30 bg-[var(--color-surface)] p-6 text-sm text-ras-gray dark:text-white/70">
          <p>Type above, or jump straight to a section:</p>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
            {["footprint", "speed run", "eligibility", "the maze"].map((term) => (
              <li key={term}>
                <Link
                  href={`/search?q=${encodeURIComponent(term)}`}
                  className="-mx-2 inline-flex min-h-[44px] items-center rounded-md px-2 font-semibold text-accent hover:underline"
                >
                  {term}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Emphasises the words the visitor typed, without building HTML from a string. */
function Highlighted({ text, terms }: { text: string; terms: string[] }) {
  return (
    <>
      {highlight(text, terms).map((part, i) =>
        part.hit ? (
          <mark
            key={i}
            className="rounded bg-[#F2A900]/35 px-0.5 text-inherit dark:bg-[#F2A900]/30"
          >
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}
