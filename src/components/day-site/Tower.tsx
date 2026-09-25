import type { RunEntry } from "@/lib/score-sheet";

/**
 * Pieces of the timing tower, the qualifying table set like a race's: the
 * place in a square block, the run log as a row of ticks, the gap to the
 * leader. Shared by the live page's top eight and the full standings.
 */

const PODIUM = ["bg-day-gold text-day-on-ink", "bg-day-ink text-day-on-ink", "bg-day-crimson text-day-on-ink"];

/** The place, in a block: gold, ink and crimson for the first three. */
export function PlaceBlock({ rank, size = "md" }: { rank: number | null; size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-7 min-w-7 text-[0.9rem]" : "h-9 min-w-9 text-[1.05rem]";
  if (!rank) {
    return (
      <span className={`day-num inline-grid ${box} place-items-center rounded-[3px] text-day-faint`} aria-label="No place yet">
        –
      </span>
    );
  }
  const tone = rank <= 3 ? PODIUM[rank - 1] : "bg-day-ink/[0.07] text-day-ink";
  return <span className={`day-num day-display inline-grid ${box} place-items-center rounded-[3px] px-1 ${tone}`}>{rank}</span>;
}

/**
 * Every run as a tick, in the order it was run: a filled square reached the
 * centre, an empty one did not. Eight minutes at a glance.
 */
export function RunTicks({ log, className = "" }: { log: RunEntry[]; className?: string }) {
  if (!log.length) return null;
  const reached = log.filter((run) => run.ok).length;
  return (
    <span className={`inline-flex items-center gap-[3px] ${className}`} role="img" aria-label={`${reached} of ${log.length} runs reached the centre`}>
      {log.map((run, index) => (
        <span
          key={index}
          className={`h-2 w-2 rounded-[1px] ${run.ok ? "bg-day-ink" : "border border-day-line/40"}`}
        />
      ))}
    </span>
  );
}

/** "−12.4" behind the leader, or "" for the leader and anyone without a score. */
export function gapToLeader(best: number | null, leader: number | null): string {
  if (best === null || leader === null || best === leader) return "";
  return `−${(leader - best).toFixed(1)}`;
}
