"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminIcon } from "@/components/admin/AdminIcons";
import { ADMIN_LINKS, isActiveLink } from "@/lib/admin-nav";

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
      {ADMIN_LINKS.map((link) => {
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
