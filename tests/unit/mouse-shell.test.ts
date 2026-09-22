import { describe, expect, it } from "vitest";
import { MOUSE_SHELL } from "@/lib/mouse-shell";
import { narrowestGapMm } from "@/lib/micromouse";
import { RULES, footprintCheck } from "@/lib/rules";
import {
  ROBOT_PARTS,
  ROBOT_WIDTH_MM,
  partBounds,
  robotExtents,
  robotFitsCorridor,
} from "@/lib/robot-parts";

const DRESSED = [...ROBOT_PARTS, ...MOUSE_SHELL];

describe("the shell the robot wears", () => {
  it("says what it is, like every other part", () => {
    const ids = DRESSED.map((part) => part.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const part of MOUSE_SHELL) {
      expect(part.label.length).toBeGreaterThan(2);
      expect(part.blurb.length).toBeGreaterThan(20);
      expect(part.detail.length).toBeGreaterThan(80);
      expect(part.colour).toMatch(/^#[0-9a-f]{6}$/i);
      expect(part.pieces.length).toBeGreaterThan(0);
      for (const piece of part.pieces) {
        if (piece.colour) expect(piece.colour).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it("costs nothing in the corridor", () => {
    // The whole argument of the viewer is that the mouse fits. Bodywork that
    // quietly widened it would make every clearance printed on the page wrong,
    // so the ears have to stay inside the wheels.
    expect(robotExtents(DRESSED).widthMm).toBe(ROBOT_WIDTH_MM);
    expect(robotFitsCorridor(DRESSED)).toBe(true);
    expect(narrowestGapMm() - robotExtents(DRESSED).widthMm).toBeGreaterThan(40);
  });

  it("keeps the tail inside the size limit", () => {
    const { widthMm, lengthMm } = robotExtents(DRESSED);
    // The tail is the only thing that reaches past the board, which makes it
    // the only part of the shell the rulebook has an opinion about.
    expect(lengthMm).toBeGreaterThan(robotExtents().lengthMm);
    expect(footprintCheck(widthMm / 10, lengthMm / 10).withinFootprint).toBe(true);
    expect(lengthMm / 10).toBeLessThan(RULES.maxFootprintCm);
  });

  it("sits on the board rather than through it", () => {
    // Everything under the top face of the chassis is occupied by electronics.
    // A cover that dips below it is drawn inside the battery.
    for (const part of MOUSE_SHELL) {
      expect(partBounds(part).min[1]).toBeGreaterThanOrEqual(0);
    }
  });

  it("lifts off upwards when the robot comes apart", () => {
    // Downwards would take it through the chassis it is sitting on.
    for (const part of MOUSE_SHELL) {
      expect(part.explode[1]).toBeGreaterThan(0);
    }
  });

  it("covers the tall parts instead of letting them through", () => {
    // The battery is the tallest thing on the board, and a corner of it poking
    // out of the curve of the shell is the most obvious way for this model to
    // look broken. The dome is an ellipsoid, so the check is the ellipsoid one.
    const shell = MOUSE_SHELL.find((part) => part.id === "shell")!;
    const dome = shell.pieces.find((piece) => piece.shape.kind === "dome")!;
    const radius = dome.shape.kind === "dome" ? dome.shape.r : 0;
    const centre = dome.at ?? [0, 0, 0];
    const scale = dome.scale ?? [1, 1, 1];

    const battery = ROBOT_PARTS.find((part) => part.id === "battery")!;
    const box = battery.shape.kind === "box" ? battery.shape : null;
    const half = [box!.w / 2, box!.h / 2, box!.d / 2];

    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        // The top corners only: the bottom of the box is under the cover.
        const corner = [
          battery.at[0] + sx * half[0]!,
          battery.at[1] + half[1]!,
          battery.at[2] + sz * half[2]!,
        ];
        const inside = corner.reduce(
          (total, value, axis) =>
            total + ((value - centre[axis]!) / (radius * scale[axis]!)) ** 2,
          0,
        );
        expect(inside).toBeLessThan(1);
      }
    }
  });

  it("measures a turned piece where it actually is", () => {
    // A bar 40mm long lying across the mouse, stood on end by a quarter turn:
    // its length has to move from the x column to the y column, or the tail
    // and the whiskers are measured in the wrong direction.
    const bar = (rotate: [number, number, number]) =>
      partBounds({
        id: "bar",
        label: "Bar",
        blurb: "",
        detail: "",
        at: [0, 0, 0],
        explode: [0, 0, 0],
        colour: "#000000",
        pieces: [{ shape: { kind: "cylinder", r: 1, h: 40, axis: "x" }, rotate }],
      });

    expect(bar([0, 0, 0]).max[0]).toBeCloseTo(20, 5);
    expect(bar([0, 0, 90]).max[0]).toBeCloseTo(1, 5);
    expect(bar([0, 0, 90]).max[1]).toBeCloseTo(20, 5);
    expect(bar([0, 90, 0]).max[2]).toBeCloseTo(20, 5);
  });

  it("leaves the sensors looking at the maze", () => {
    // The sensor pips sit at y = 5 on a bar 10mm deep at the nose. The snout
    // arches over them, and a shell in front of an emitter is a blind mouse
    // that looks like a software bug.
    const sensors = ROBOT_PARTS.find((part) => part.id === "sensors")!;
    const sensorTop = sensors.at[1] + (sensors.shape.kind === "cylinder" ? sensors.shape.r : 0);
    const shell = MOUSE_SHELL.find((part) => part.id === "shell")!;

    for (const piece of shell.pieces) {
      const at = piece.at ?? [0, 0, 0];
      const aheadOfTheBar = at[2] >= sensors.at[2] - 6;
      if (!aheadOfTheBar) continue;
      expect(at[1]).toBeGreaterThan(sensorTop);
    }
  });
});
