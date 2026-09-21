"use client";

import { useState } from "react";
import { footprintCheck } from "@/lib/rules";
import { GEOMETRY, TIGHT_CLEAR_MM, clearance, narrowestGapMm } from "@/lib/micromouse";

/**
 * How much mouse fits down a corridor, drawn to scale.
 *
 * The rulebook's size rule is 25cm square, and taken on its own it is
 * misleading: a mouse can pass it and be undrivable, because the corridor is
 * nothing like 25cm wide. Both answers are on screen at once here, because the
 * gap between them is where a first chassis goes wrong.
 *
 * Drawn in millimetres at a fixed scale rather than stretched to fit. A
 * diagram about clearances that is not to scale is worse than no diagram.
 */

const SCALE = 1.6; // px per mm in the viewBox
const PAD = 26;

export function MouseSizing() {
  const [widthMm, setWidthMm] = useState(96);
  const [lengthMm, setLengthMm] = useState(104);

  const gap = narrowestGapMm();
  const fit = clearance(widthMm, lengthMm);
  // The rulebook's own check, in the units it uses.
  const legal = footprintCheck(widthMm / 10, lengthMm / 10);

  const wall = GEOMETRY.wallThicknessMm;
  const laneW = TIGHT_CLEAR_MM;
  const boardW = laneW + wall * 2;
  const boardH = Math.max(lengthMm + 60, TIGHT_CLEAR_MM + 40);

  return (
    <div className="not-prose rounded-2xl border border-ras-purple/20 bg-[var(--color-surface)] p-4 dark:border-white/15 sm:p-6">
      <div className="grid gap-6 sm:grid-cols-[220px_minmax(0,1fr)] sm:items-start">
        <div className="space-y-4">
          <Slider
            id="mouse-width"
            label="Width"
            value={widthMm}
            min={40}
            max={200}
            onChange={setWidthMm}
          />
          <Slider
            id="mouse-length"
            label="Length"
            value={lengthMm}
            min={40}
            max={220}
            onChange={setLengthMm}
          />

          <dl className="space-y-1 text-sm">
            <Row term="Gap to drive down" value={`${gap} mm`} />
            <Row
              term="Either side"
              value={fit.fits ? `${fit.eachSideMm} mm` : "none"}
              tone={fit.fits ? (fit.eachSideMm < 15 ? "warn" : "good") : "bad"}
            />
            <Row
              term="Turns on the spot"
              value={fit.spins ? "yes" : "no"}
              tone={fit.spins ? "good" : "bad"}
            />
            <Row
              term="Inside the 25cm rule"
              value={legal.withinFootprint ? "yes" : "no"}
              tone={legal.withinFootprint ? "good" : "bad"}
            />
          </dl>
        </div>

        <div>
          <svg
            viewBox={`0 0 ${(boardW + PAD * 2) * SCALE} ${boardH * SCALE}`}
            role="img"
            aria-label={`A corridor ${gap} millimetres wide with a mouse ${widthMm} by ${lengthMm} millimetres in it. ${fit.verdict}`}
            className="h-auto w-full"
          >
            <g transform={`scale(${SCALE})`}>
              {/* The two walls, at their real thickness. */}
              <rect x={PAD} y={0} width={wall} height={boardH} className="fill-ras-purple/80 dark:fill-white/70" />
              <rect
                x={PAD + wall + laneW}
                y={0}
                width={wall}
                height={boardH}
                className="fill-ras-purple/80 dark:fill-white/70"
              />

              {/* The mouse, centred in the lane. */}
              <rect
                x={PAD + wall + (laneW - widthMm) / 2}
                y={(boardH - lengthMm) / 2}
                width={widthMm}
                height={lengthMm}
                rx={4}
                className={
                  fit.fits && fit.spins
                    ? "fill-ras-crimson/25 stroke-ras-crimson"
                    : "fill-[#f2a900]/25 stroke-[#f2a900]"
                }
                strokeWidth={2}
              />

              {/* The circle it sweeps turning on the spot. */}
              <circle
                cx={PAD + wall + laneW / 2}
                cy={boardH / 2}
                r={Math.sqrt(widthMm * widthMm + lengthMm * lengthMm) / 2}
                fill="none"
                strokeDasharray="5 4"
                strokeWidth={1.4}
                className="stroke-ras-gray/70 dark:stroke-white/50"
              />

              <text
                x={PAD + wall + laneW / 2}
                y={14}
                textAnchor="middle"
                fontSize={11}
                className="fill-ras-gray dark:fill-white/70"
              >
                {gap} mm
              </text>
            </g>
          </svg>

          <p className="mt-3 text-sm leading-relaxed text-ras-gray dark:text-white/75">{fit.verdict}</p>
          <p className="mt-2 text-xs text-ras-gray dark:text-white/55">
            The dashed circle is what the mouse sweeps turning on the spot. The walls are drawn at
            their real {wall}mm, and the gap already has the rulebook&rsquo;s 5% tolerance taken off
            it, in the direction that hurts.
          </p>
        </div>
      </div>
    </div>
  );
}

function Slider({
  id,
  label,
  value,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="flex items-baseline justify-between text-sm font-semibold text-ras-purple dark:text-white">
        {label}
        <span className="font-mono text-xs text-ras-gray dark:text-white/60">{value} mm</span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={2}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full accent-ras-crimson"
      />
    </div>
  );
}

function Row({ term, value, tone }: { term: string; value: string; tone?: "good" | "warn" | "bad" }) {
  const colour =
    tone === "bad"
      ? "text-ras-crimson dark:text-[#ff9b9b]"
      : tone === "warn"
        ? "text-[#a86b00] dark:text-[#ffb45f]"
        : tone === "good"
          ? "text-ras-purple dark:text-white"
          : "text-ras-gray dark:text-white/70";

  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-ras-gray/10 pb-1 dark:border-white/10">
      <dt className="text-ras-gray dark:text-white/60">{term}</dt>
      <dd className={`font-semibold ${colour}`}>{value}</dd>
    </div>
  );
}
