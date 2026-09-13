import Link from "next/link";
import manifestJson from "../../../public/rulebook/manifest.json";

/**
 * The invitation into the 3D rulebook, at the top of the classic rules page.
 *
 * Dressed like the book it opens — the leather and gold of the PDF's cover,
 * with the cover itself tilted off the card — so it reads as an object to pick
 * up rather than one more notice. A server component: it is a link and a
 * picture, and ships no JavaScript.
 */
export function RulebookBookBanner() {
  const pdf = (manifestJson as { pdf: string }).pdf;

  return (
    <section className="book-banner" aria-labelledby="book-banner-title">
      <Link href="/rules/book" className="book-banner-cover" tabIndex={-1} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/rulebook/pages/p01-sm.webp" alt="" width={596} height={842} />
      </Link>

      <div className="book-banner-text">
        <p className="book-banner-eyebrow">
          <span className="book-banner-new">New</span>
          Official Rulebook &amp; Contest Manual &middot; Version 1
        </p>
        <h2 id="book-banner-title" className="book-banner-title">
          Flip through the 3D Rulebook
        </h2>
        <p className="book-banner-lede">
          The official manual, page by page, in a book you can flip through. Interactive pages sit
          next to the rules on the maze, runs, robot size and scoring.
        </p>
        <div className="book-banner-actions">
          <Link href="/rules/book" className="book-banner-primary">
            Open the 3D Rulebook
            <span aria-hidden="true">&rarr;</span>
          </Link>
          <a href={pdf} download className="book-banner-secondary">
            Download PDF
          </a>
        </div>
      </div>
    </section>
  );
}
