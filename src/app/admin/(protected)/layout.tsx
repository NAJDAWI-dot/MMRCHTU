import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

/**
 * Never prerender anything under the admin area.
 *
 * These pages are per-session and show live database state, so a copy built at
 * deploy time would be both stale and wrong. Without this the build tried to
 * render them with no request behind them, which meant querying the database
 * during `next build` — the reason a deploy against an empty database used to
 * fail before the site was ever served.
 */
export const dynamic = "force-dynamic";

const NAV_LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/schedule", label: "Schedule" },
  { href: "/admin/competition-day", label: "Competition Day" },
  { href: "/admin/faq", label: "FAQ" },
  { href: "/admin/gallery", label: "Gallery" },
  { href: "/admin/register-form", label: "Register Form" },
  { href: "/admin/registrations", label: "Registrations" },
  { href: "/admin/broadcasts", label: "Email Lists" },
  { href: "/admin/admins", label: "Admins" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    // Stacked on a phone, side by side from md up. A fixed 192px column on a
    // 375px screen left the actual admin content 136px wide.
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:flex-row md:gap-8 md:py-10">
      <aside className="w-full shrink-0 md:w-48">
        <p className="mb-3 text-xs uppercase tracking-widest text-ras-gray dark:text-white/50 md:mb-4">
          Signed in as {admin.username}
        </p>
        {/*
          A horizontal strip of chips on a phone, the usual column from md up.
          Nine stacked links would push every admin page a screen and a half
          down; scrolling them sideways keeps the page itself reachable.
        */}
        <nav
          aria-label="Admin"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-col md:overflow-visible md:px-0 md:pb-0"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="shrink-0 whitespace-nowrap rounded-md border border-ras-gray/20 px-3 py-2 text-sm font-medium text-ras-gray transition-colors hover:bg-ras-purple/10 hover:text-ras-purple dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-white md:border-0"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <form action="/admin/logout" method="post" className="mt-3 md:mt-4">
          <button
            type="submit"
            className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-ras-crimson transition-colors hover:bg-ras-crimson/10"
          >
            Log out
          </button>
        </form>
      </aside>
      {/*
        min-w-0 is what actually stops the overflow: a flex child defaults to
        min-width:auto, so wide content pushes the column past the screen
        instead of shrinking and wrapping inside it.
      */}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
