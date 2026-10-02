import { guardHiddenPage } from "@/lib/page-visibility";

/** 404s this route while hidden. See guardHiddenPage. */
export default async function ResultsLayout({ children }: { children: React.ReactNode }) {
  await guardHiddenPage("/results");
  return <>{children}</>;
}
