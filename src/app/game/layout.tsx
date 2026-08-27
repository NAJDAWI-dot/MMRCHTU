import { guardHiddenPage } from "@/lib/page-visibility";

/**
 * 404s this route while an admin has it hidden. See guardHiddenPage.
 *
 * A layout rather than a call inside page.tsx, so anything nested under this
 * route disappears with it rather than staying reachable by URL.
 */
export default async function GameLayout({ children }: { children: React.ReactNode }) {
  await guardHiddenPage("/game");
  return <>{children}</>;
}
