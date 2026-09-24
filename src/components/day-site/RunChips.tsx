import { DayIcon } from "@/components/day-site/icons";
import { formatTime, type RunEntry } from "@/lib/score-sheet";

/**
 * Every run of a sheet in the order it was run: a successful one by its time,
 * the official (fastest) one picked out in gold, and a failed one crossed, with
 * the cell it reached when that was written down.
 */
export function RunChips({ log, official, small = false }: { log: RunEntry[]; official: number | null; small?: boolean }) {
  const officialIndex = official === null ? -1 : log.findIndex((run) => run.ok && run.time === official);
  const chip = small ? "rounded-md px-2 py-0.5 text-xs" : "rounded-lg px-2.5 py-1 text-sm";
  return (
    <ol className="flex flex-wrap gap-1.5" aria-label="Runs">
      {log.map((run, index) => {
        const best = index === officialIndex;
        if (run.ok) {
          return (
            <li
              key={index}
              className={`day-num inline-flex items-baseline gap-1.5 ${chip} ${
                best ? "bg-day-gold/15 font-bold text-day-gold ring-1 ring-day-gold/40" : "bg-day-ink/[0.05] text-day-ink"
              }`}
            >
              {small ? null : <span className="text-[10px] font-semibold text-day-faint">R{index + 1}</span>}
              {formatTime(run.time)}
              <span className="sr-only">{best ? "(successful, the official time)" : "(successful)"}</span>
            </li>
          );
        }
        const detail = run.cell !== null ? `Cell ${run.cell}` : "";
        return (
          <li key={index} className={`day-num inline-flex items-center gap-1.5 ${chip} bg-day-live/10 text-day-live`}>
            {small ? null : <span className="text-[10px] font-semibold opacity-70">R{index + 1}</span>}
            <DayIcon name="close" className="h-3 w-3 shrink-0" />
            <span className="sr-only">Failed</span>
            {detail || <span aria-hidden="true">Failed</span>}
          </li>
        );
      })}
    </ol>
  );
}
