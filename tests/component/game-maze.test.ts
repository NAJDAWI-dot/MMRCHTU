import { describe, expect, it } from "vitest";
import {
  buildMaze,
  isWall,
  ROWS,
  COLS,
  RAW,
  GAME_SPEED_SCALE,
  MOUSE_SPEED_SCALE,
  ROBOT_SPEED_SCALE,
} from "@/game/classic/shared";
import { sanitisePlayerName, isGameMode, MAX_NAME_LENGTH } from "@/lib/leaderboard";

// Built with String.fromCharCode so no literal control bytes sit in this file.
const BELL = String.fromCharCode(7);
const NUL = String.fromCharCode(0);

describe("Pac Mouse maze is fully enclosed", () => {
  const maze = buildMaze();

  it("walls every tile on the outer border", () => {
    for (let c = 0; c < COLS; c++) {
      expect(isWall(maze, 0, c, false), `top border col ${c}`).toBe(true);
      expect(isWall(maze, ROWS - 1, c, false), `bottom border col ${c}`).toBe(true);
    }
    for (let r = 0; r < ROWS; r++) {
      expect(isWall(maze, r, 0, false), `left border row ${r}`).toBe(true);
      expect(isWall(maze, r, COLS - 1, false), `right border row ${r}`).toBe(true);
    }
  });

  it("has no open side tunnel on the old tunnel row", () => {
    // Row 9 used to read " ......#   #...... " with open ends that wrapped
    // travel from one side of the maze to the other.
    expect(RAW[9]!.startsWith("#")).toBe(true);
    expect(RAW[9]!.endsWith("#")).toBe(true);
  });

  it("treats out-of-bounds columns as solid so nothing can wrap around", () => {
    for (let r = 0; r < ROWS; r++) {
      expect(isWall(maze, r, -1, false)).toBe(true);
      expect(isWall(maze, r, COLS, false)).toBe(true);
      // Robots (forGhost) must not get a wrap exemption either.
      expect(isWall(maze, r, -1, true)).toBe(true);
      expect(isWall(maze, r, COLS, true)).toBe(true);
    }
  });
});

describe("speed tuning", () => {
  it("slows the whole game down from the original pace", () => {
    expect(GAME_SPEED_SCALE).toBeLessThan(1);
  });

  it("keeps the mouse faster than a patrolling robot so the game stays winnable", () => {
    expect(MOUSE_SPEED_SCALE).toBeGreaterThan(ROBOT_SPEED_SCALE);
  });

  it("keeps per-frame steps under half the centre-detection tolerance", () => {
    // Movement snaps to tile centres within 1.5px; a step of 3px or more can
    // straddle a centre without ever landing inside it, which breaks turning.
    const maxLevelBase = (2.0 + 5 * 0.12) * GAME_SPEED_SCALE;
    expect(maxLevelBase * MOUSE_SPEED_SCALE * 1.08).toBeLessThan(3);
  });
});

describe("sanitisePlayerName", () => {
  it("trims and collapses whitespace", () => {
    expect(sanitisePlayerName("  Ada   Lovelace  ")).toBe("Ada Lovelace");
  });

  it("strips control characters", () => {
    expect(sanitisePlayerName(`Ada${BELL}Lovelace`)).toBe("AdaLovelace");
    expect(sanitisePlayerName("Ada\nLovelace")).toBe("Ada Lovelace");
  });

  it("truncates to the maximum name length", () => {
    expect(sanitisePlayerName("A".repeat(50))).toHaveLength(MAX_NAME_LENGTH);
  });

  it("returns an empty string when nothing usable is left", () => {
    expect(sanitisePlayerName("   ")).toBe("");
    expect(sanitisePlayerName(NUL)).toBe("");
  });
});

describe("isGameMode", () => {
  it("accepts the two board modes and rejects anything else", () => {
    expect(isGameMode("classic")).toBe(true);
    expect(isGameMode("fp")).toBe(true);
    expect(isGameMode("cheat")).toBe(false);
  });
});
