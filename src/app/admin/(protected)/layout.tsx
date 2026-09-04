import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "@/components/admin/AdminNav";
import { Button } from "@/components/ui/Button";

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

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const monogram = admin.username.trim().charAt(0).toUpperCase() || "?";

  return (
    // Stacked on a phone, side by side from md up. A fixed 192px column on a
    // 375px screen left the actual admin content 136px wide.
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:flex-row md:gap-8 md:py-10">
      {/*
        A panel from md up, plain stacked content on a phone. Given a border and
        a surface on a narrow screen it would be a box around a box around the
        page, which buys nothing at the width where space is worth the most.
      */}
      <aside className="w-full shrink-0 md:w-56 md:self-start md:rounded-xl md:border md:border-ras-gray/20 md:bg-[var(--color-surface)] md:p-3 md:shadow-sm md:dark:border-white/10">
        <div className="mb-4 flex items-center gap-3 px-1 md:px-2">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ras-purple font-display text-sm font-extrabold text-white dark:bg-white/15"
          >
            {monogram}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-ras-purple dark:text-white">
              {admin.username}
            </span>
            <span className="block text-xs text-ras-gray dark:text-white/50">Signed in</span>
          </span>
        </div>

        <AdminNav />

        <form action="/admin/logout" method="post" className="mt-3 px-1 md:px-0">
          <Button type="submit" variant="ghost" size="sm" className="w-full">
            Log out
          </Button>
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
