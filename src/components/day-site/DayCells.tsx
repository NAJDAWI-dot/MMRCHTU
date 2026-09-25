/**
 * The day counted the way a maze is: one cell per team (or per match), filled
 * as it runs, crimson while it is on the maze, dashed once it is out. A glance
 * says how far through the phase the day is, and hovering a cell says whose
 * it is. The numbers are always said in words next to it, so the strip itself
 * is hidden from screen readers.
 */

export type CellState = "waiting" | "here" | "ran" | "live" | "out" | "through" | "won";

export interface DayCell {
  id: string;
  name: string;
  state: CellState;
}

const SAYS: Record<CellState, string> = {
  waiting: "still to come",
  here: "checked in",
  ran: "has run",
  live: "on the maze now",
  out: "out",
  through: "through",
  won: "won",
};

export function DayCells({ cells, size = 18, className = "" }: { cells: DayCell[]; size?: number; className?: string }) {
  return (
    <ol className={`day-cells ${className}`} data-reveal aria-hidden="true" style={{ ["--cell" as string]: `${size}px` }}>
      {cells.map((cell, index) => (
        <li
          key={cell.id}
          data-state={cell.state}
          data-cell-team={cell.id}
          className="day-tip"
          data-tip={`${cell.name}, ${SAYS[cell.state]}`}
          style={{ ["--c" as string]: index }}
        />
      ))}
    </ol>
  );
}

/** What the cells mean, drawn with the cells themselves. */
export function CellKey({ items }: { items: { state: CellState; label: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[0.8125rem] font-medium text-day-muted" aria-hidden="true">
      {items.map((item) => (
        <li key={item.state} className="flex items-center gap-1.5">
          <span className="day-cells" style={{ ["--cell" as string]: "11px" }}>
            <span data-state={item.state} />
          </span>
          {item.label}
        </li>
      ))}
    </ul>
  );
}
