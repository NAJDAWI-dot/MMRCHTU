import { describe, expect, it } from "vitest";
import { ghostEatScore, POINTS } from "@/game/engine/scoring";

describe("ghostEatScore", () => {
  it("follows the classic 200/400/800/1600 chain", () => {
    expect(ghostEatScore(0)).toBe(200);
    expect(ghostEatScore(1)).toBe(400);
    expect(ghostEatScore(2)).toBe(800);
    expect(ghostEatScore(3)).toBe(1600);
  });

  it("caps at the final chain value for longer chains", () => {
    expect(ghostEatScore(10)).toBe(1600);
  });
});

describe("POINTS", () => {
  it("defines pellet and power pellet base values", () => {
    expect(POINTS.pellet).toBe(10);
    expect(POINTS.powerPellet).toBe(50);
  });
});
