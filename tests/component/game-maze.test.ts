import { describe, expect, it } from "vitest";
import {
  buildMaze,
  isWall,
  ROWS,
  COLS,
  TILE,
  RAW,
  DIRS,
  advance,
  isTypingTarget,
  entTile,
  tileCenter,
  GAME_SPEED_SCALE,
  MOUSE_SPEED_SCALE,
  ROBOT_SPEED_SCALE,
  type Dir,
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

  it("leaves the mouse a workable margin over a chasing robot", () => {
    // The size of this gap is the main difficulty dial. Too narrow and a chase
    // is unshakeable; the maze played as "too hard" at a 0.07 margin.
    expect(MOUSE_SPEED_SCALE - ROBOT_SPEED_SCALE).toBeGreaterThanOrEqual(0.1);
  });

  it("keeps a per-frame step well inside one tile so nothing skips a wall", () => {
    // A step of a whole tile or more could jump clean over a wall tile between
    // two open ones. This is the only bound the movement model needs — there is
    // deliberately no *lower* bound, see the regression test below.
    // 0.12 is a deliberate over-estimate of the per-level ramp (currently 0.1),
    // so this stays a valid ceiling if the ramp is dialled back up again.
    const maxLevelBase = (2.0 + 5 * 0.12) * GAME_SPEED_SCALE;
    expect(maxLevelBase * MOUSE_SPEED_SCALE * 1.08).toBeLessThan(TILE / 2);
  });
});

describe("isTypingTarget", () => {
  // The games bind controls on window and preventDefault() WASD/arrows, so
  // without this guard the leaderboard's name field could not be typed into.
  const el = (tag: string) => document.createElement(tag);

  it("recognises the fields a player types into", () => {
    expect(isTypingTarget(el("input"))).toBe(true);
    expect(isTypingTarget(el("textarea"))).toBe(true);
    expect(isTypingTarget(el("select"))).toBe(true);
  });

  it("recognises contenteditable elements, including nested ones", () => {
    // The attribute rather than the contentEditable property: jsdom does not
    // implement the property, so assigning it would not reflect to the DOM.
    const div = el("div") as HTMLDivElement;
    expect(isTypingTarget(div)).toBe(false);
    div.setAttribute("contenteditable", "true");
    expect(isTypingTarget(div)).toBe(true);

    const child = el("span");
    div.appendChild(child);
    expect(isTypingTarget(child)).toBe(true);
  });

  it("ignores an explicitly non-editable region", () => {
    const div = el("div") as HTMLDivElement;
    div.setAttribute("contenteditable", "false");
    expect(isTypingTarget(div)).toBe(false);
  });

  it("leaves ordinary elements and a null target to the game controls", () => {
    expect(isTypingTarget(el("canvas"))).toBe(false);
    expect(isTypingTarget(el("button"))).toBe(false);
    expect(isTypingTarget(document.body)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
    // window is a plausible event target and has no tagName.
    expect(isTypingTarget(window)).toBe(false);
  });
});

describe("advance()", () => {
  const maze = buildMaze();
  const canGo = (e: { x: number; y: number }, dir: Dir) => {
    const t = entTile(e);
    const d = DIRS[dir];
    return !isWall(maze, t.r + d.y, t.c + d.x, false);
  };

  /** Runs the mouse down the open corridor of row 11 for `frames` frames. */
  function runMouse(speed: number, frames: number) {
    const start = tileCenter(11, 9);
    const e = { x: start.x, y: start.y, dir: "left" as Dir, speed };
    for (let i = 0; i < frames; i++) advance(e, (dir) => canGo(e, dir));
    return e;
  }

  it("moves the mouse at the tuned game speed (regression: it froze in place)", () => {
    // The bug: the old model re-snapped anything within 1.5px of a tile centre,
    // so once the tuned step (~1.38px) fell below that window the mouse was
    // dragged back every frame and never left its starting tile.
    const speed = 2.0 * GAME_SPEED_SCALE * MOUSE_SPEED_SCALE;
    expect(speed).toBeLessThan(1.5); // the step size that used to freeze it
    const after = runMouse(speed, 60);
    expect(after.x).toBeCloseTo(tileCenter(11, 9).x - speed * 60, 5);
    expect(entTile(after).c).toBeLessThan(9);
  });

  it("travels the full distance at any speed, however small", () => {
    // 10 frames keeps even the fastest of these short of the wall at col 1.
    for (const speed of [0.05, 0.3, 1.38, 4, 9]) {
      const after = runMouse(speed, 10);
      expect(after.x, `speed ${speed}`).toBeCloseTo(tileCenter(11, 9).x - speed * 10, 5);
    }
  });

  it("parks on the tile centre when it runs into a wall instead of entering it", () => {
    // Row 11 is open from col 1 to col 17; col 0 is the outer wall.
    const after = runMouse(1.38, 2000);
    expect(after.x).toBe(tileCenter(11, 1).x);
    expect(entTile(after).c).toBe(1);
  });

  it("turns only at a tile centre and keeps the leftover distance", () => {
    // Row 12 is "#.##.#.#####.#.##.#", so col 6 is the open way down out of row 11.
    const ctr = tileCenter(11, 6);
    // Start 8px short of that centre, heading left, with 10px of travel to spend.
    const e = { x: ctr.x + 8, y: ctr.y, dir: "left" as Dir, speed: 10 };
    advance(e, (dir) => canGo(e, dir), () => { e.dir = "down"; });
    expect(e.x).toBe(ctr.x); // snapped onto the centre before turning
    expect(e.y).toBeCloseTo(ctr.y + (10 - 8), 5); // leftover distance carried into the turn
  });
});

describe("every pellet is reachable from where the mouse starts", () => {
  it("reaches all crumbs and cheese, and only the robot house stays sealed off", () => {
    const maze = buildMaze();
    const seen = new Set<string>();
    const spawn = { r: 11, c: 9 }; // resetActors() places the mouse here
    const queue = [spawn];
    seen.add(`${spawn.r},${spawn.c}`);

    while (queue.length) {
      const { r, c } = queue.pop()!;
      for (const d of Object.values(DIRS)) {
        const nr = r + d.y;
        const nc = c + d.x;
        const key = `${nr},${nc}`;
        if (seen.has(key) || isWall(maze, nr, nc, false)) continue;
        seen.add(key);
        queue.push({ r: nr, c: nc });
      }
    }

    const unreachable: string[] = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const t = maze[r]![c];
        if (t === "#" || t === "-") continue;
        if (!seen.has(`${r},${c}`)) unreachable.push(`${t === " " ? "blank" : t} at ${r},${c}`);
      }

    // The only blanks the mouse cannot enter are the three inside the robot
    // house, which is sealed by its door — nothing else, and no pellets at all.
    expect(unreachable).toEqual(["blank at 9,8", "blank at 9,9", "blank at 9,10"]);
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
