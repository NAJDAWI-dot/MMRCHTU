"use client";

import { useId, useState } from "react";
import { RULES, footprintCheck } from "@/lib/rules";
import { Figure, Stat } from "@/components/rules/Figure";

/**
 * The footprint rule, made checkable.
 *
 * Two numbers decide whether a chassis is legal, and teams generally find out
 * which side of the line they are on after the aluminium is cut. Typing the
 * dimensions in takes a moment and answers it.
 *
 * The second readout is not a rule and is labelled as such. It exists because
 * the rulebook's two dimensions pull in opposite directions: the footprint
 * limit is larger than a cell is wide, so a mouse can be entirely legal and
 * still be unable to turn around inside the maze. Nobody should discover that
 * on competition day.
 */

/** The drawing is in centimetres, with room around the limit box for breathing. */
const FIELD = 30;
const centred = (size: number) => (FIELD - size) / 2;

export function RobotFootprint() {
  const [width, setWidth] = useState("10");
  const [length, setLength] = useState("12");
  const widthId = useId();
  const lengthId = useId();

  // Empty and half-typed values land here as NaN; footprintCheck reports those
  // as invalid rather than guessing, and the SVG falls back to nothing drawn.
  const check = footprintCheck(Number(width), Number(length));
  const w = check.valid ? Math.min(check.widthCm, FIELD) : 0;
  const l = check.valid ? Math.min(check.lengthCm, FIELD) : 0;

  return (
    <Figure
      id="footprint"
      title="Will your mouse fit?"
      caption={
        <>
          The dashed square is the {RULES.maxFootprintCm}cm × {RULES.maxFootprintCm}cm limit; the
          solid one is a single {RULES.cellSizeCm}cm cell. Measure your widest points — wheels,
          sensors and bumpers included.
        </>
      }
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <svg
          viewBox={`0 0 ${FIELD} ${FIELD}`}
          role="img"
          aria-label={
            check.valid
              ? `A ${check.widthCm} by ${check.lengthCm} centimetre robot drawn inside a ${RULES.cellSizeCm} centimetre maze cell and the ${RULES.maxFootprintCm} centimetre footprint limit.`
              : `An empty maze cell and footprint limit, waiting for robot dimensions.`
          }
          className="h-auto w-full max-w-xs justify-self-center"
        >
          <rect
            x={centred(RULES.maxFootprintCm)}
            y={centred(RULES.maxFootprintCm)}
            width={RULES.maxFootprintCm}
            height={RULES.maxFootprintCm}
            fill="none"
            strokeWidth={0.25}
            strokeDasharray="1 0.8"
            className="stroke-ras-gray dark:stroke-white/50"
          />
          <rect
            x={centred(RULES.cellSizeCm)}
            y={centred(RULES.cellSizeCm)}
            width={RULES.cellSizeCm}
            height={RULES.cellSizeCm}
            fill="none"
            strokeWidth={0.5}
            className="stroke-ras-purple dark:stroke-white/80"
          />

          {check.valid ? (
            <>
              {/* The circle the mouse sweeps if it spins on the spot. When it
                  escapes the solid square, it cannot turn inside a cell. */}
              <circle
                cx={FIELD / 2}
                cy={FIELD / 2}
                r={check.diagonalCm / 2}
                fill="none"
                strokeWidth={0.2}
                strokeDasharray="0.6 0.6"
                className={
                  check.turnsInsideCell
                    ? "stroke-ras-purple/50 dark:stroke-white/40"
                    : "stroke-ras-crimson dark:stroke-rose-400"
                }
              />
              <rect
                x={centred(w)}
                y={centred(l)}
                width={w}
                height={l}
                rx={0.6}
                className={
                  check.withinFootprint
                    ? "fill-ras-purple/30 stroke-ras-purple dark:fill-white/25 dark:stroke-white"
                    : "fill-ras-crimson/30 stroke-ras-crimson dark:fill-rose-400/30 dark:stroke-rose-400"
                }
                strokeWidth={0.4}
              />
            </>
          ) : null}
        </svg>

        <div>
          <div className="space-y-4">
            {(
              [
                { id: widthId, label: "Width", value: width, set: setWidth },
                { id: lengthId, label: "Length", value: length, set: setLength },
              ] as const
            ).map((field) => (
              <div key={field.id}>
                <label
                  htmlFor={field.id}
                  className="block text-sm font-semibold text-ras-purple dark:text-white"
                >
                  {field.label} (cm)
                </label>
                <div className="mt-1 flex items-center gap-3">
                  <input
                    id={field.id}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={FIELD}
                    step={0.5}
                    value={field.value}
                    onChange={(event) => field.set(event.target.value)}
                    className="w-20 min-h-[44px] rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-2 py-1 text-ras-purple dark:text-white"
                  />
                  <input
                    type="range"
                    aria-label={`${field.label} in centimetres`}
                    min={0}
                    max={FIELD}
                    step={0.5}
                    value={Number.isFinite(Number(field.value)) ? Number(field.value) : 0}
                    onChange={(event) => field.set(event.target.value)}
                    className="h-11 min-w-0 flex-1 accent-ras-purple"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Announced as the sliders move, so the verdict is not a visual-only
              result that a screen reader user has to go hunting for. */}
          <div className="mt-5 space-y-2" aria-live="polite">
            {check.valid ? (
              <>
                <Verdict ok={check.withinFootprint} rule>
                  {check.withinFootprint
                    ? `Within the ${RULES.maxFootprintCm}cm footprint`
                    : `Over the ${RULES.maxFootprintCm}cm footprint — not eligible`}
                </Verdict>
                <Verdict ok={check.turnsInsideCell}>
                  {check.turnsInsideCell
                    ? `Turns inside a cell, with ${check.turnClearanceCm}cm to spare`
                    : `Too wide to turn on the spot by ${Math.abs(check.turnClearanceCm)}cm`}
                </Verdict>
              </>
            ) : (
              <p className="text-sm text-ras-gray dark:text-white/70">
                Enter both dimensions to check.
              </p>
            )}
          </div>

          {check.valid ? (
            <dl className="mt-5 grid grid-cols-2 gap-4">
              <Stat label="Corner to corner" value={`${check.diagonalCm}cm`} />
              <Stat
                label="Cell clearance"
                value={`${check.turnClearanceCm}cm`}
                tone={check.turnsInsideCell ? "good" : "bad"}
              />
            </dl>
          ) : null}
        </div>
      </div>
    </Figure>
  );
}

/**
 * One pass/fail line.
 *
 * `rule` separates the two readouts: failing the footprint means the mouse
 * cannot compete, while failing the turning check only means it will not do
 * well. Presenting advice in the same voice as a rule would be misleading.
 */
function Verdict({
  ok,
  rule = false,
  children,
}: {
  ok: boolean;
  rule?: boolean;
  children: React.ReactNode;
}) {
  return (
    <p
      className={`flex items-start gap-2 text-sm font-medium ${
        ok ? "text-ras-purple dark:text-white" : "text-ras-crimson dark:text-rose-300"
      }`}
    >
      <span aria-hidden="true" className="mt-px font-bold">
        {ok ? "✓" : "✕"}
      </span>
      <span>
        {children}
        {rule ? null : (
          <span className="ml-1 font-normal text-ras-gray dark:text-white/60">
            (guidance, not a rule)
          </span>
        )}
      </span>
    </p>
  );
}
