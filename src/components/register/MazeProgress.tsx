/**
 * Registration progress, as a mouse working down a corridor.
 *
 * Two numbered circles told you which step you were on and nothing else. This
 * says the same thing in the site's own terms: the form is a run, the steps
 * are cells, and the cheese at the end is the thing you are heading for.
 *
 * The drawing is decorative and hidden from assistive technology — the list
 * underneath it is the real progress indicator, still carrying `aria-current`
 * on the step you are on, so nothing about this is worse for a screen reader
 * than the circles were.
 */

import { MAZE_GOLD } from "@/lib/maze";

/** Cell side in viewBox units, matching the maze engine's own. */
const CELL = 20;

export interface ProgressStep {
  n: number;
  label: string;
}

export function MazeProgress({ step, steps }: { step: number; steps: readonly ProgressStep[] }) {
  // One cell per step, plus the goal cell they are heading for.
  const cells = steps.length + 1;
  const width = cells * CELL;
  const done = step > steps.length;

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${CELL}`}
        width={width * 2.1}
        height={CELL * 2.1}
        aria-hidden="true"
        focusable="false"
        className="max-w-full"
      >
        {/* The corridor: an outer wall, and a stub between each pair of cells
            leaving a doorway in the middle. Drawn rather than boxed, so it
            reads as somewhere to travel rather than as a row of tiles. */}
        <rect
          x={1}
          y={1}
          width={width - 2}
          height={CELL - 2}
          rx={2}
          fill="none"
          strokeWidth={2}
          className="stroke-ras-purple/35 dark:stroke-white/30"
        />
        {Array.from({ length: cells - 1 }, (_, i) => {
          const x = (i + 1) * CELL;
          return (
            <g key={i} strokeWidth={2} className="stroke-ras-purple/35 dark:stroke-white/30">
              <path d={`M${x} 1 V${CELL * 0.3}`} />
              <path d={`M${x} ${CELL * 0.7} V${CELL - 1}`} />
            </g>
          );
        })}

        {/* The cheese, in the goal cell. */}
        <g transform={`translate(${(cells - 1) * CELL + CELL / 2}, ${CELL / 2})`}>
          <path d="M-5 1 L1 -4 L5 -1 L4 1 Z" fill={MAZE_GOLD} />
          <path d="M-5 1 L4 1 L4 4 Q0 6 -5 4 Z" fill={MAZE_GOLD} fillOpacity={0.75} />
        </g>

        {/*
          The mouse, one cell per completed step. Its x is animated rather than
          jumped, so moving between steps reads as travel — which is the entire
          reason this is a corridor and not two circles.
        */}
        <g
          className="maze-progress-mouse"
          style={{ transform: `translateX(${(Math.min(step, cells) - 1) * CELL}px)` }}
        >
          {/* Drawn here rather than reusing MouseMark: that component owns its
              own <svg> element, and a nested one with no width would size
              itself to the whole viewport instead of to a cell. */}
          <g
            transform={`translate(${CELL / 2}, ${CELL / 2}) scale(0.5)`}
            className="fill-ras-purple dark:fill-white"
          >
            <circle className="maze-progress-ear" cx={-5.4} cy={-7.2} r={4} />
            <circle className="maze-progress-ear" cx={5.4} cy={-7.2} r={4} />
            <ellipse cx={0} cy={0} rx={7.2} ry={6.4} />
          </g>
        </g>
      </svg>

      <ol
        className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold"
        aria-label="Registration progress"
      >
        {steps.map(({ n, label }, i) => (
          <li key={n} className="flex items-center gap-2">
            <span
              aria-current={step === n ? "step" : undefined}
              className={
                step >= n
                  ? "text-ras-purple dark:text-white"
                  : "text-ras-gray dark:text-white/60"
              }
            >
              {label}
            </span>
            {i < steps.length - 1 ? (
              <span aria-hidden="true" className="text-ras-gray/40">
                —
              </span>
            ) : null}
          </li>
        ))}
        {done ? <li className="text-accent">Done</li> : null}
      </ol>
    </div>
  );
}
