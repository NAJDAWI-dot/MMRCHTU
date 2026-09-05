import type { AdminIconName } from "@/components/admin/AdminIcons";

/**
 * The admin destinations, in one place.
 *
 * Lifted out of AdminNav once the command palette needed the same list. Two
 * copies would have meant a new admin page appearing in the sidebar and not in
 * the palette — or, worse, the other way round, where the only route to a page
 * is a shortcut nobody knows to press.
 *
 * The order is the sidebar's reading order, and the palette keeps it for an
 * empty query, so pressing the shortcut and pressing nothing else shows the
 * same menu the sidebar does.
 */
export interface AdminLink {
  href: string;
  label: string;
  icon: AdminIconName;
  /**
   * Words someone might type instead of the label.
   *
   * "Email Lists" is what the page is called and "broadcast" is what everyone
   * calls the thing it does; a palette that only matched the label would come
   * up empty for the word the admin actually has in mind.
   */
  keywords?: string;
}

export const ADMIN_LINKS: AdminLink[] = [
  { href: "/admin", label: "Dashboard", icon: "dashboard", keywords: "home overview" },
  { href: "/admin/analytics", label: "Analytics", icon: "analytics", keywords: "stats charts numbers" },
  { href: "/admin/schedule", label: "Schedule", icon: "schedule", keywords: "dates timeline events" },
  {
    href: "/admin/competition-day",
    label: "Competition Day",
    icon: "competition",
    keywords: "venue running order",
  },
  { href: "/admin/faq", label: "FAQ", icon: "faq", keywords: "questions answers" },
  { href: "/admin/gallery", label: "Gallery", icon: "gallery", keywords: "photos albums pictures" },
  { href: "/admin/pages", label: "Pages", icon: "pages", keywords: "visibility hide show" },
  {
    href: "/admin/register-form",
    label: "Register Form",
    icon: "form",
    keywords: "registration fields deadline",
  },
  {
    href: "/admin/registrations",
    label: "Registrations",
    icon: "registrations",
    keywords: "teams entries members",
  },
  {
    href: "/admin/payments",
    label: "Payments",
    icon: "payments",
    keywords: "money cliq fees reconciliation",
  },
  {
    href: "/admin/broadcasts",
    label: "Email Lists",
    icon: "email",
    keywords: "broadcast mailing send",
  },
  { href: "/admin/admins", label: "Admins", icon: "admins", keywords: "accounts users staff" },
];

/**
 * Whether a nav item is the page you are looking at.
 *
 * The dashboard has to match exactly, because every other admin route begins
 * with `/admin` and a prefix rule would light Dashboard up on all twelve
 * screens. Everything else matches on prefix, so a detail route like
 * `/admin/gallery/<id>` keeps its parent item lit rather than leaving the whole
 * nav dark on the page you actually navigated to.
 *
 * The prefix is compared with a trailing slash so `/admin/pages` cannot claim
 * a hypothetical `/admin/pages-archive`.
 */
export function isActiveLink(href: string, pathname: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}
