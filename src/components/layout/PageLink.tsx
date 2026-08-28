import Link from "next/link";
import { hiddenPageHrefs } from "@/lib/page-visibility";

/**
 * A link to a page an admin might have switched off.
 *
 * The site menu has always filtered itself, but every other link on the site
 * was written by hand and knew nothing about the Pages tab — so hiding Rules
 * removed it from the menu while the homepage went on offering a card that led
 * straight to "not found". That is the exact outcome the feature exists to
 * prevent, and it needed something cheaper to reach for than an `await` and a
 * conditional at every call site.
 *
 * Two behaviours, because the two shapes of link fail differently. Inline in a
 * sentence — "the schedule has what is coming" — the words still have to be
 * there or the prose breaks, so the link becomes plain text. A standalone call
 * to action reads as broken if it stays on the page unlinked, so that one
 * disappears entirely: pass `omitWhenHidden`.
 *
 * An async Server Component, so it can only be used from server components.
 * The read behind it is React-cached, so a page rendering several of these
 * still makes one query.
 */
interface PageLinkProps {
  href: string;
  className?: string;
  /** Render nothing at all when hidden, rather than the text on its own. */
  omitWhenHidden?: boolean;
  children: React.ReactNode;
}

export async function PageLink({
  href,
  className,
  omitWhenHidden = false,
  children,
}: PageLinkProps) {
  const hidden = await hiddenPageHrefs();

  if (hidden.has(href)) {
    return omitWhenHidden ? null : <>{children}</>;
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
