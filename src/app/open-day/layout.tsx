import { guardHiddenPage } from "@/lib/page-visibility";

/**
 * 404s this route while an admin has it hidden. See guardHiddenPage.
 *
 * The switch matters more here than on the other pages: this one is for one
 * day, and the day after it should stop being in the menu without anybody
 * needing a deploy.
 */
export default async function OpenDayLayout({ children }: { children: React.ReactNode }) {
  await guardHiddenPage("/open-day");
  return <>{children}</>;
}
