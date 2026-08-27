import { guardHiddenPage } from "@/lib/page-visibility";

/**
 * 404s this route while hidden. See guardHiddenPage.
 *
 * Stacked on top of the page's own HIDDEN status rather than replacing it: that
 * status also chooses between the coming-soon text and the full details, so it
 * is not a visibility switch that happens to have three values.
 */
export default async function CompetitionDayLayout({ children }: { children: React.ReactNode }) {
  await guardHiddenPage("/competition-day");
  return <>{children}</>;
}
