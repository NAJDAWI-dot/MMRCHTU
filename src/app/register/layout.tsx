import { guardHiddenPage } from "@/lib/page-visibility";

/**
 * 404s this route while hidden. See guardHiddenPage.
 *
 * Distinct from RegisterFormConfig.isOpen, which keeps the page up and explains
 * that registration has closed. Hiding it removes the page entirely, which is
 * the right thing before it opens and the wrong thing after it shuts.
 */
export default async function RegisterLayout({ children }: { children: React.ReactNode }) {
  await guardHiddenPage("/register");
  return <>{children}</>;
}
