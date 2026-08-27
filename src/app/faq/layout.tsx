import { guardHiddenPage } from "@/lib/page-visibility";

/** 404s this route while hidden. See guardHiddenPage. */
export default async function FaqLayout({ children }: { children: React.ReactNode }) {
  await guardHiddenPage("/faq");
  return <>{children}</>;
}
