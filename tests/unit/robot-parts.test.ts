import { describe, expect, it } from "vitest";
import { footprintCheck } from "@/lib/rules";
import { narrowestGapMm } from "@/lib/micromouse";
import {
  ROBOT_LENGTH_MM,
  ROBOT_PARTS,
  ROBOT_WIDTH_MM,
  partPosition,
  robotExtents,
  robotFitsCorridor,
} from "@/lib/robot-parts";

describe("the robot in the viewer", () => {
  it("names every part exactly once, with something to say about it", () => {
    const ids = ROBOT_PARTS.map((part) => part.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const part of ROBOT_PARTS) {
      expect(part.label.length).toBeGreaterThan(2);
      expect(part.blurb.length).toBeGreaterThan(20);
      // The panel is the reason the viewer exists. A part with nothing behind
      // it is a shape in a box.
      expect(part.detail.length).toBeGreaterThan(80);
      expect(part.colour).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("is the size the page says it is", () => {
    const extents = robotExtents();
    expect(extents.widthMm).toBe(ROBOT_WIDTH_MM);
    expect(extents.lengthMm).toBe(ROBOT_LENGTH_MM);
  });

  it("is legal, and also actually drives", () => {
    // Two different questions, and the guide is about the gap between them.
    const legal = footprintCheck(ROBOT_WIDTH_MM / 10, ROBOT_LENGTH_MM / 10);
    expect(legal.withinFootprint).toBe(true);
    expect(robotFitsCorridor()).toBe(true);
    expect(narrowestGapMm() - ROBOT_WIDTH_MM).toBeGreaterThan(40);
  });

  it("assembles at zero and comes apart at one", () => {
    for (const part of ROBOT_PARTS) {
      expect(partPosition(part, 0)).toEqual(part.at);
      expect(partPosition(part, 1)).toEqual([
        part.at[0] + part.explode[0],
        part.at[1] + part.explode[1],
        part.at[2] + part.explode[2],
      ]);
    }
  });

  it("refuses to fly further apart than all the way", () => {
    const part = ROBOT_PARTS[0]!;
    expect(partPosition(part, 4)).toEqual(partPosition(part, 1));
    expect(partPosition(part, -2)).toEqual(part.at);
  });

  it("stands on its wheels", () => {
    // The wheels and the rear slider have to reach the same floor, or the
    // mouse is drawn hovering and every clearance on the page is a fiction.
    const wheel = ROBOT_PARTS.find((p) => p.id === "wheel-left")!;
    const caster = ROBOT_PARTS.find((p) => p.id === "caster")!;
    const wheelBottom = wheel.at[1] - (wheel.shape.kind === "cylinder" ? wheel.shape.r : 0);
    const casterBottom = caster.at[1] - (caster.shape.kind === "sphere" ? caster.shape.r : 0);
    expect(Math.abs(wheelBottom - casterBottom)).toBeLessThanOrEqual(1);
  });
});
