import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

const NAV_LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/schedule", label: "Schedule" },
  { href: "/admin/faq", label: "FAQ" },
  { href: "/admin/register-form", label: "Register Form" },
  { href: "/admin/registrations", label: "Registrations" },
  { href: "/admin/broadcasts", label: "Email Lists" },
  { href: "/admin/admins", label: "Admins" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="mx-auto flex max-w-6xl gap-8 px-4 py-10">
      <aside className="w-48 shrink-0">
        <p className="mb-4 text-xs uppercase tracking-widest text-ras-gray dark:text-white/50">
          Signed in as {admin.username}
        </p>
        <nav aria-label="Admin" className="flex flex-col gap-2">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-ras-gray transition-colors hover:bg-ras-purple/10 hover:text-ras-purple dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <form action="/admin/logout" method="post" className="mt-4">
          <button
            type="submit"
            className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-ras-crimson transition-colors hover:bg-ras-crimson/10"
          >
            Log out
          </button>
        </form>
      </aside>
      <div className="flex-1">{children}</div>
    </div>
  );
}
