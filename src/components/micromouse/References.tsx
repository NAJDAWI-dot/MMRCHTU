import { hostLabel } from "@/lib/links";
import {
  KIND_HEADINGS,
  groupReferences,
  thumbnailFor,
  type Reference,
} from "@/lib/references";

/**
 * The reading list at the foot of the build guide.
 *
 * The guide is deliberately about this competition, which leaves out
 * everything written for the 16x16 maze the rest of the world runs. This is
 * where that goes, kept separate and labelled, so nobody takes a number off
 * somebody else's blog and builds to it.
 *
 * A server component with no script behind it. YouTube stills come straight
 * from the image host, so a card looks like the video it points at without
 * embedding a player, and nothing here loads a frame that watches the reader.
 */
export function References({ items }: { items: Reference[] }) {
  const groups = groupReferences(items);
  if (groups.length === 0) return null;

  return (
    <section id="references" className="mt-14 border-t border-ras-gray/15 pt-8 dark:border-white/10">
      <h2 className="font-display text-2xl font-extrabold text-ras-purple dark:text-white">
        Where to look next
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ras-gray dark:text-white/70">
        None of this is ours and none of it is written for our maze. Most of it assumes a 16x16
        maze rather than our 10x10, and a scoring formula that is not ours either, so take the
        technique and leave the numbers behind: ours are in the rulebook.
      </p>

      {groups.map((group) => (
        <div key={group.kind} className="mt-8">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-ras-crimson dark:text-[#ff9b9b]">
            {KIND_HEADINGS[group.kind]}
          </h3>
          <ul className="mt-3 grid gap-4 sm:grid-cols-2">
            {group.items.map((reference) => (
              <li key={reference.id}>
                <ReferenceCard reference={reference} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function ReferenceCard({ reference }: { reference: Reference }) {
  const still = thumbnailFor(reference);
  const host = hostLabel(reference.url);
  // Videos and playlists get a frame whether or not YouTube has a picture for
  // them. A playlist link carries no video id, so without this the card for a
  // whole playlist looked exactly like the card for a blog post.
  const framed = reference.kind === "VIDEO" || reference.kind === "PLAYLIST";

  return (
    <a
      href={reference.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-ras-purple/20 bg-[var(--color-surface)] shadow-sm transition-colors hover:border-ras-purple/50 dark:border-white/15 dark:hover:border-white/35"
    >
      {framed ? (
        <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-mood-orchid/40 via-ras-purple/25 to-mood-rose/40 dark:from-mood-violet/50 dark:to-mood-rose/40">
          {still ? (
            /* eslint-disable-next-line @next/next/no-img-element -- YouTube's own
               still, served at a fixed size from its image host; next/image would
               proxy every thumbnail through our optimiser for nothing */
            <img
              src={still}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
          ) : null}
          <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ras-crimson/90 text-white shadow-lg transition-transform group-hover:scale-110">
              <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5 fill-current">
                <path d="M8 5.5v13l11-6.5z" />
              </svg>
            </span>
          </span>
          {reference.kind === "PLAYLIST" ? (
            <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-white">
              Playlist
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-1 flex-col p-4">
        <h4 className="font-display text-base font-extrabold leading-snug text-ras-purple group-hover:underline dark:text-white">
          {reference.title}
        </h4>
        {reference.author ? (
          <p className="mt-1 text-xs font-semibold text-ras-gray dark:text-white/60">
            {reference.author}
          </p>
        ) : null}
        {reference.note ? (
          <p className="mt-2 text-sm leading-relaxed text-ras-gray dark:text-white/70">
            {reference.note}
          </p>
        ) : null}
        {/* Where the click actually goes, said before it is clicked. */}
        <p className="mt-3 text-xs text-ras-gray/80 dark:text-white/50">
          {host} <span aria-hidden="true">↗</span>
          <span className="sr-only">(opens in a new tab)</span>
        </p>
      </div>
    </a>
  );
}
