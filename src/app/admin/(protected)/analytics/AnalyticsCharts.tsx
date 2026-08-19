import { Card } from "@/components/ui/Card";
import { percent, type DayBucket, type Tally } from "@/lib/analytics";

/**
 * Chart primitives for the analytics page.
 *
 * Deliberately CSS-only — no charting library. At this data size a bar is a
 * div with a width, and shipping a chart bundle to an admin page that four
 * people open would cost more than it explains.
 */

export function StatTile({
  value,
  label,
  hint,
}: {
  value: number | string;
  label: string;
  hint?: string;
}) {
  return (
    <Card>
      <p className="font-display text-3xl font-extrabold text-ras-purple dark:text-white">{value}</p>
      <p className="mt-1 text-sm font-medium text-ras-gray dark:text-white/70">{label}</p>
      {hint && <p className="mt-1 text-xs text-ras-gray/80 dark:text-white/50">{hint}</p>}
    </Card>
  );
}

export function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <h2 className="font-display text-base font-bold text-ras-purple dark:text-white">{title}</h2>
      {description && (
        <p className="mt-1 text-xs text-ras-gray dark:text-white/60">{description}</p>
      )}
      <div className="mt-4">{children}</div>
    </Card>
  );
}

/** Ranked horizontal bars. The share is shown as well as the count, because a
 *  count alone does not say whether 6 is most of the field or a corner of it. */
export function BarList({ data, total }: { data: Tally[]; total: number }) {
  if (data.length === 0) return <Empty />;

  return (
    <ul className="flex flex-col gap-3">
      {data.map((row) => {
        const share = percent(row.value, total);
        return (
          <li key={row.label}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-ras-gray dark:text-white/80" title={row.label}>
                {row.label}
              </span>
              <span className="shrink-0 tabular-nums font-semibold text-ras-purple dark:text-white">
                {row.value}
                <span className="ml-1 font-normal text-ras-gray/70 dark:text-white/50">
                  {share}%
                </span>
              </span>
            </div>
            <div
              className="mt-1 h-1.5 overflow-hidden rounded-full bg-ras-purple/10 dark:bg-white/10"
              role="img"
              aria-label={`${row.label}: ${row.value} of ${total} (${share}%)`}
            >
              {/* Never fully zero-width, so a non-zero bucket is still visible. */}
              <div
                className="h-full rounded-full bg-ras-purple dark:bg-mood-rose"
                style={{ width: row.value > 0 ? `${Math.max(share, 2)}%` : "0%" }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Day-by-day columns. Scrolls rather than squeezing when the range is long. */
export function DayChart({ data }: { data: DayBucket[] }) {
  const peak = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((sum, d) => sum + d.count, 0);

  if (total === 0) {
    return <Empty message="Nothing registered in this window yet." />;
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-full items-end gap-1" style={{ height: "96px" }}>
        {data.map((day) => (
          <div key={day.key} className="flex min-w-[14px] flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[10px] tabular-nums text-ras-gray dark:text-white/60">
              {day.count > 0 ? day.count : ""}
            </span>
            <div
              className="w-full rounded-sm bg-ras-purple/80 dark:bg-mood-rose/80"
              style={{ height: `${(day.count / peak) * 72}px`, minHeight: day.count > 0 ? "3px" : "1px" }}
              role="img"
              aria-label={`${day.label}: ${day.count}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-ras-gray dark:text-white/50">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}

export function Empty({ message = "No data yet." }: { message?: string }) {
  return <p className="text-sm text-ras-gray/80 dark:text-white/50">{message}</p>;
}
