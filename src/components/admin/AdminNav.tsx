"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminIcon, type AdminIconName } from "@/components/admin/AdminIcons";

interface AdminLink {
  href: string;
  label: string;
  icon: AdminIconName;
}

const NAV_LINKS: AdminLink[] = [
  { href: "/admin", label: "Dashboard", icon: "dashboard" },
  { href: "/admin/analytics", label: "Analytics", icon: "analytics" },
  { href: "/admin/schedule", label: "Schedule", icon: "schedule" },
  { href: "/admin/competition-day", label: "Competition Day", icon: "competition" },
  { href: "/admin/faq", label: "FAQ", icon: "faq" },
  { href: "/admin/gallery", label: "Gallery", icon: "gallery" },
  { href: "/admin/pages", label: "Pages", icon: "pages" },
  { href: "/admin/register-form", label: "Register Form", icon: "form" },
  { href: "/admin/registrations", label: "Registrations", icon: "registrations" },
  { href: "/admin/payments", label: "Payments", icon: "payments" },
  { href: "/admin/broadcasts", label: "Email Lists", icon: "email" },
  { href: "/admin/admins", label: "Admins", icon: "admins" },
];

/**
 * Whether a nav item is the page you are looking at.
 *
 * Exported for its test. The dashboard has to match exactly, because every
 * other admin route begins with `/admin` and a prefix rule would light
 * Dashboard up on all twelve screens. Everything else matches on prefix, so a
 * detail route like `/admin/gallery/<id>` keeps its parent item lit rather than
 * leaving the whole nav dark on the page you actually navigated to.
 *
 * The prefix is compared with a trailing slash so `/admin/pages` cannot claim
 * a hypothetical `/admin/pages-archive`.
 */
export function isActiveLink(href: string, pathname: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav() {
  const pathname = usePathname() ?? "";

  return (
    /*
      A horizontal strip of chips on a phone, the usual column from md up.
      A dozen stacked links would push every admin page a screen and a half
      down; scrolling them sideways keeps the page itself reachable.
    */
    <nav
      aria-label="Admin"
      className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 md:mx-0 md:flex-col md:overflow-visible md:px-0 md:pb-0"
    >
      {NAV_LINKS.map((link) => {
        const active = isActiveLink(link.href, pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`group flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-[background-color,color,box-shadow] duration-150 motion-reduce:transition-none ${
              active
                ? "bg-ras-purple text-white shadow-sm dark:bg-white/15 dark:text-white"
                : "text-ras-gray hover:bg-ras-purple/10 hover:text-ras-purple dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
            }`}
          >
            <AdminIcon
              name={link.icon}
              className={`h-4 w-4 transition-opacity ${active ? "opacity-100" : "opacity-60 group-hover:opacity-100"}`}
            />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
