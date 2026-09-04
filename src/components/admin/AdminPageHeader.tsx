import type { ReactNode } from "react";

/**
 * The top of every admin screen.
 *
 * All twelve pages used to open with the same hand-copied
 * `<h1 className="font-display text-2xl font-extrabold …">`, and several then
 * hand-rolled their own summary line and their own action row underneath. One
 * component instead, so the heading, the summary and the page-level buttons
 * cannot drift apart from screen to screen — and so there is somewhere to add
 * the next thing every page needs, once, rather than twelve times.
 */
export function AdminPageHeader({
  title,
  /** The one-line summary of what is on the page — counts, usually. */
  subtitle,
  /** Page-level controls, kept on the heading row rather than orphaned above the content. */
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 border-b border-ras-gray/15 pb-4 dark:border-white/10">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ras-purple dark:text-white">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1.5 text-sm text-ras-gray dark:text-white/70">{subtitle}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
