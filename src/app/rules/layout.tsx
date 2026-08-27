import { guardHiddenPage } from "@/lib/page-visibility";

/** 404s this route, and the checklist under it, while hidden. See guardHiddenPage. */
export default async function RulesLayout({ children }: { children: React.ReactNode }) {
  await guardHiddenPage("/rules");
  return <>{children}</>;
}
