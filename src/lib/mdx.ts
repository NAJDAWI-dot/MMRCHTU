import type { ComponentType } from "react";

/**
 * Content-loader abstraction: pages consume these functions, never read
 * files directly. Swapping in a headless CMS later means changing only
 * this module's implementation, not the pages that call it.
 *
 * Schedule and FAQ content moved to the ScheduleEvent/FaqEntry Prisma models
 * (admin-editable). The /rules page is now the official PDF as a flip-book
 * (see `src/lib/rulebook-book.ts`); `content/rules/rulebook.mdx` remains as
 * the prose the site search indexes.
 */

/**
 * The site's legal pages, slug to title.
 *
 * One place that decides which pages exist, so the route's static params, the
 * footer links and the sitemap cannot disagree about the set.
 */
export const LEGAL_PAGES = {
  terms: "Terms of Service",
  privacy: "Privacy Policy",
  "payment-refund-policy": "Payment & Refund Policy",
  "code-of-conduct": "Code of Conduct",
} as const;

export type LegalSlug = keyof typeof LEGAL_PAGES;

export function isLegalSlug(value: string): value is LegalSlug {
  return Object.prototype.hasOwnProperty.call(LEGAL_PAGES, value);
}

/**
 * An explicit switch rather than a template-literal import path.
 *
 * `import(\`../../content/legal/${slug}.mdx\`)` would build, but the bundler
 * can only guess at what it might load and pulls the whole folder in. Spelled
 * out, each import is statically analysable.
 */
export async function loadLegalPage(slug: LegalSlug): Promise<ComponentType> {
  switch (slug) {
    case "terms":
      return (await import("../../content/legal/terms.mdx")).default;
    case "privacy":
      return (await import("../../content/legal/privacy.mdx")).default;
    case "payment-refund-policy":
      return (await import("../../content/legal/payment-refund-policy.mdx")).default;
    case "code-of-conduct":
      return (await import("../../content/legal/code-of-conduct.mdx")).default;
  }
}
