"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { narrowestGapMm } from "@/lib/micromouse";
import { ROBOT_WIDTH_MM, ROBOT_LENGTH_MM } from "@/lib/robot-parts";
import {
  LAYOUT_LABELS,
  SENSOR_RANGE_MM,
  layoutSegments,
  readAll,
  steering,
  type Layout,
  type Pose,
} from "@/lib/sensors";

/**
 * Five sensors, and a mouse you can put anywhere.
 *
 * The thing nobody believes until they see it is that a wall sensor does not
 * report a wall. It reports a distance along one line, and "there is a wall on
 * my left" is a conclusion the mouse draws from a number that changes as it
 * moves. Drag the mouse off centre and the left reading falls while the right
 * one rises. Turn it and both change at once, which is the case that breaks a
 * naive controller.
 *
 * The fourth layout is the important one. In a cell with no side walls the
 * steering loop has nothing to work from, the readout says so, and that is the
 * paragraph in the guide about buying a gyroscope, arriving as a demonstration
 * rather than as advice.
 */

const HALF = narrowestGapMm() / 2;
const VIEW = { minX: -HALF - 26, width: (HALF + 26) * 2, minY: -270, height: 450 };
const LAYOUTS: Layout[] = ["corridor", "left-opening", "t-junction", "dead-end"];

export function SensorRig() {
  const [layout, setLayout] = useState<Layout>("corridor");
  const [pose, setPose] = useState<Pose>({ x: 0, y: 0, heading: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const segments = useMemo(() => layoutSegments(layout), [layout]);
  const readings = useMemo(() => readAll(pose, segments), [pose, segments]);
  const drive = useMemo(() => steering(readings), [readings]);

  const moveTo = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const vx = VIEW.minX + ((clientX - rect.left) / rect.width) * VIEW.width;
    const vy = VIEW.minY + ((clientY - rect.top) / rect.height) * VIEW.height;
    setPose((current) => keepInside({ ...current, x: vx, y: clamp(-vy, -150, 230) }));
  }, []);

  return (
    <div className="not-prose rounded-2xl border border-ras-purple/20 bg-[var(--color-surface)] p-4 dark:border-white/15 sm:p-6">
      <div className="flex flex-wrap gap-2">
        {LAYOUTS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setLayout(option)}
            aria-pressed={layout === option}
            className={`min-h-[40px] rounded-full px-3.5 text-sm font-semibold transition-colors ${
              layout === option
                ? "bg-ras-purple text-white"
                : "border border-ras-purple/40 text-ras-purple dark:border-white/30 dark:text-white"
            }`}
          >
            {LAYOUT_LABELS[option]}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-5 sm:grid-cols-[minmax(0,260px)_minmax(0,1fr)] sm:items-start">
        <div>
          <svg
            ref={svgRef}
            viewBox={`${VIEW.minX} ${VIEW.minY} ${VIEW.width} ${VIEW.height}`}
            role="img"
            aria-label={`A mouse in a ${LAYOUT_LABELS[layout].toLowerCase()}, ${Math.abs(Math.round(pose.x))}mm ${pose.x < 0 ? "left" : "right"} of centre and turned ${Math.round(pose.heading)} degrees, with its five sensor rays drawn.`}
            className="h-auto w-full cursor-grab touch-none select-none active:cursor-grabbing"
            onPointerDown={(event) => {
              dragging.current = true;
              event.currentTarget.setPointerCapture(event.pointerId);
              moveTo(event.clientX, event.clientY);
            }}
            onPointerMove={(event) => {
              if (dragging.current) moveTo(event.clientX, event.clientY);
            }}
            onPointerUp={(event) => {
              dragging.current = false;
              event.currentTarget.releasePointerCapture?.(event.pointerId);
            }}
          >
            {/* The floor, which is black plywood. */}
            <rect
              x={-HALF}
              y={VIEW.minY}
              width={HALF * 2}
              height={VIEW.height}
              className="fill-ras-purple/5 dark:fill-white/5"
            />

            {segments.map((wall, i) => (
              <line
                key={i}
                x1={wall.x1}
                y1={-wall.y1}
                x2={wall.x2}
                y2={-wall.y2}
                strokeWidth={12}
                strokeLinecap="butt"
                className="stroke-ras-purple/85 dark:stroke-white/80"
              />
            ))}

            {readings.map((reading) => (
              <g key={reading.sensor.id}>
                <line
                  x1={reading.from[0]}
                  y1={-reading.from[1]}
                  x2={reading.to[0]}
                  y2={-reading.to[1]}
                  strokeWidth={2}
                  strokeDasharray={reading.distance === null ? "6 5" : undefined}
                  className={
                    reading.distance === null
                      ? "stroke-ras-gray/45 dark:stroke-white/25"
                      : "stroke-[#f2a900]"
                  }
                />
                {reading.distance !== null ? (
                  <circle cx={reading.to[0]} cy={-reading.to[1]} r={4} className="fill-[#f2a900]" />
                ) : null}
              </g>
            ))}

            {/* The mouse itself, drawn at the size of the one in the viewer. */}
            {/* Screen y runs the other way from world y, and the heading is
                clockwise-positive, so the two flips cancel and this is a plain
                positive rotation. */}
            <g transform={`translate(${pose.x} ${-pose.y}) rotate(${pose.heading})`}>
              <rect
                x={-ROBOT_WIDTH_MM / 2}
                y={-ROBOT_LENGTH_MM / 2}
                width={ROBOT_WIDTH_MM}
                height={ROBOT_LENGTH_MM}
                rx={8}
                className="fill-ras-crimson/25 stroke-ras-crimson"
                strokeWidth={3}
              />
              {/* Which way is forward. */}
              <path
                d={`M 0 ${-ROBOT_LENGTH_MM / 2 - 12} L -12 ${-ROBOT_LENGTH_MM / 2 + 6} L 12 ${-ROBOT_LENGTH_MM / 2 + 6} Z`}
                className="fill-ras-crimson"
              />
            </g>
          </svg>

          <label htmlFor="heading" className="mt-3 flex items-baseline justify-between text-sm font-semibold text-ras-purple dark:text-white">
            Turn it
            <span className="font-mono text-xs text-ras-gray dark:text-white/60">
              {Math.round(pose.heading)}°
            </span>
          </label>
          <input
            id="heading"
            type="range"
            min={-40}
            max={40}
            value={pose.heading}
            onChange={(event) =>
              setPose((current) =>
                keepInside({ ...current, heading: Number(event.target.value) }),
              )
            }
            className="mt-1 w-full accent-ras-crimson"
          />
          <p className="mt-1 text-xs text-ras-gray dark:text-white/55">
            Drag the mouse anywhere in the corridor.
          </p>
        </div>

        <div>
          <ul className="space-y-2">
            {readings.map((reading) => (
              <li key={reading.sensor.id}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-semibold text-ras-purple dark:text-white">
                    {reading.sensor.label}
                  </span>
                  <span className="font-mono text-xs text-ras-gray dark:text-white/60">
                    {reading.distance === null ? "no wall" : `${Math.round(reading.distance)} mm`}
                  </span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-ras-gray/15 dark:bg-white/15">
                  <div
                    className={`h-full rounded-full ${
                      reading.distance === null ? "bg-ras-gray/30" : "bg-[#f2a900]"
                    }`}
                    style={{
                      // Near walls read strong and far ones weak, which is how
                      // an infrared pair behaves and the opposite of distance.
                      width: `${reading.distance === null ? 4 : Math.max(4, 100 - (reading.distance / SENSOR_RANGE_MM) * 100)}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-4 rounded-xl border border-ras-purple/20 bg-ras-purple/5 p-3 dark:border-white/15 dark:bg-white/5">
            <p className="text-sm text-ras-gray dark:text-white/75">
              Steering from <strong className="text-ras-purple dark:text-white">{drive.basis}</strong>.
            </p>
            {drive.basis === "nothing to see" ? (
              <p className="mt-1 text-sm leading-relaxed text-ras-crimson dark:text-[#ff9b9b]">
                No wall either side, so the loop has nothing to correct against. This is the cell
                where a gyroscope stops being optional.
              </p>
            ) : (
              <p className="mt-1 text-sm leading-relaxed text-ras-gray dark:text-white/75">
                Error {drive.error > 0 ? "+" : ""}
                {drive.error}mm, so add {Math.abs(drive.correction)} to the{" "}
                {drive.correction > 0 ? "left" : drive.correction < 0 ? "right" : "neither"} wheel
                and take it off the other. At zero it is driving down the middle.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/**
 * Keeps the whole mouse between the walls, not just the point it turns about.
 *
 * A turned mouse is wider than its width: the body's shadow across the
 * corridor is half its width times the cosine plus half its length times the
 * sine. Clamping the centre alone let the corner go through the plywood, and a
 * sensor reading taken from outside the maze is nonsense presented as a
 * measurement.
 */
function keepInside(pose: Pose): Pose {
  const a = (pose.heading * Math.PI) / 180;
  const reach =
    (ROBOT_WIDTH_MM / 2) * Math.abs(Math.cos(a)) + (ROBOT_LENGTH_MM / 2) * Math.abs(Math.sin(a));
  const room = Math.max(0, HALF - reach - 1);
  return { ...pose, x: clamp(pose.x, -room, room) };
}
