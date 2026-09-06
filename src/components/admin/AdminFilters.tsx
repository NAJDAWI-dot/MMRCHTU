import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { PAYMENT_STATUSES, PAYMENT_STATUS_LABELS } from "@/lib/payment";

/**
 * Finding one team among a hundred.
 *
 * A plain GET form on purpose. Both list pages are already `force-dynamic`
 * server components, so putting the query in the URL costs nothing, survives a
 * refresh, and can be linked to or bookmarked — none of which client-side
 * filtering gives you. It also needs no JavaScript at all, and, importantly,
 * it leaves every row's `<form action={serverAction}>` alone: a GET form and a
 * server-action POST form sit side by side here, never nested, which is the
 * arrangement HTML actually permits.
 *
 * The status options come from `PAYMENT_STATUSES` rather than a local literal,
 * so this dropdown cannot offer a value the database does not hold.
 */
export function AdminFilters({
  q,
  status,
  /**
   * Carried through as a hidden field rather than dropped.
   *
   * A GET form submits only its own controls, so without this, filtering a
   * list you had deliberately re-sorted would silently throw the sort away and
   * hand back the default order.
   */
  sort,
  /** Where "Clear" goes — the same page with no query at all. */
  basePath,
}: {
  q?: string;
  status?: string;
  sort?: string;
  basePath: string;
}) {
  const filtered = Boolean(q || status);

  return (
    <form
      method="get"
      className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-ras-gray/20 bg-[var(--color-surface)] p-3 dark:border-white/10"
    >
      {sort ? <input type="hidden" name="sort" value={sort} /> : null}

      <div className="min-w-0 flex-1 basis-48">
        <label
          htmlFor="admin-filter-q"
          className="block text-xs font-semibold text-ras-gray dark:text-white/60"
        >
          Search
        </label>
        <input
          id="admin-filter-q"
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Team name or email"
          className="mt-1 w-full min-h-[40px] rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-3 py-1.5 text-sm text-[var(--color-fg)] transition-colors focus-visible:border-ras-purple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ras-purple/40 dark:focus-visible:border-white dark:focus-visible:ring-white/30"
        />
      </div>

      <div className="basis-40">
        <label
          htmlFor="admin-filter-status"
          className="block text-xs font-semibold text-ras-gray dark:text-white/60"
        >
          Payment
        </label>
        <select
          id="admin-filter-status"
          name="status"
          defaultValue={status ?? ""}
          className="mt-1 w-full min-h-[40px] rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-2 py-1.5 text-sm text-[var(--color-fg)] transition-colors focus-visible:border-ras-purple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ras-purple/40 dark:focus-visible:border-white dark:focus-visible:ring-white/30"
        >
          <option value="">Any</option>
          {PAYMENT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {PAYMENT_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        {/* Matched to the inputs' height rather than left at the small size's
            own, so the row reads as one control strip instead of a button
            sitting in a dip beside two taller fields. */}
        <Button type="submit" size="sm" className="min-h-[40px]">
          Filter
        </Button>
        {filtered ? (
          <Link
            href={basePath}
            className="rounded-md px-2 py-1.5 text-sm font-medium text-ras-gray underline-offset-2 hover:text-ras-purple hover:underline dark:text-white/70 dark:hover:text-white"
          >
            Clear
          </Link>
        ) : null}
      </div>
    </form>
  );
}
