import { DayIcon } from "@/components/day-site/icons";
import { formatTime, type RunEntry } from "@/lib/score-sheet";

/**
 * Every run of a sheet in the order it was run: a successful one by its time,
 * the official (fastest) one picked out in gold, and a failed one crossed, with
 * the cell it reached when that was written down. A return, centre back to
 * start, is marked ↩ beside the run it followed.
 */
export function RunChips({ log, official, small = false }: { log: RunEntry[]; official: number | null; small?: boolean }) {
  const officialIndex = official === null ? -1 : log.findIndex((run) => run.ok && run.time === official);
  const chip = small ? "rounded-[2px] px-2 py-0.5 text-xs" : "rounded-[3px] px-2.5 py-1 text-sm";
  return (
    <ol className="flex flex-wrap gap-1.5" aria-label="Runs">
      {log.map((run, index) => {
        const best = index === officialIndex;
        const number = log.slice(0, index + 1).filter((entry) => !entry.ret).length;
        const tag = run.ret ? "↩" : `R${number}`;
        if (run.ok) {
          return (
            <li
              key={index}
              className={`day-num inline-flex items-baseline gap-1.5 ${chip} ${
                best ? "bg-day-gold/15 font-bold text-day-gold ring-1 ring-day-gold/40" : "bg-day-ink/[0.05] text-day-ink"
              }`}
            >
              {small && !run.ret ? null : <span className="text-[10px] font-semibold text-day-faint" aria-hidden={run.ret || undefined}>{tag}</span>}
              {formatTime(run.time)}
              <span className="sr-only">
                {run.ret ? (best ? "(a return back to the start, the official time)" : "(a return back to the start)") : best ? "(successful, the official time)" : "(successful)"}
              </span>
            </li>
          );
        }
        const detail = run.ret ? "Not back" : run.cell !== null ? `Cell ${run.cell}` : "";
        return (
          <li key={index} className={`day-num inline-flex items-center gap-1.5 ${chip} bg-day-live/10 text-day-live`}>
            {small && !run.ret ? null : <span className="text-[10px] font-semibold opacity-70" aria-hidden={run.ret || undefined}>{tag}</span>}
            <DayIcon name="close" className="h-3 w-3 shrink-0" />
            <span className="sr-only">{run.ret ? "A return that did not make it back" : "Failed"}</span>
            {detail || <span aria-hidden="true">Failed</span>}
          </li>
        );
      })}
    </ol>
  );
}
