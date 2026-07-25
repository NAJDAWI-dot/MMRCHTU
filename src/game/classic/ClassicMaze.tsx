"use client";

import { useEffect, useRef } from "react";
import {
  ROWS,
  COLS,
  TILE,
  DIRS,
  OPP,
  ROBOT_DEFS,
  isWall,
  buildMaze,
  countPellets,
  isTypingTarget,
  advance,
  entTile,
  tileCenter,
  GAME_SPEED_SCALE,
  MOUSE_SPEED_SCALE,
  ROBOT_SPEED_SCALE,
  GOLD,
  NEON,
  type Dir,
  type MazeGrid,
} from "./shared";
import { audioInit, sndMunch, sndCheese, sndEatRobot, sndDeath, sndLevel, sndStart, isMuted, toggleMute } from "./audio";
import { GAME_OVER_EVENT, type GameOverDetail } from "@/lib/leaderboard";

type Phase = "idle" | "ready" | "play" | "paused" | "dying" | "levelup" | "over";
type RobotMode = "house" | "exit" | "scatter" | "chase" | "fright" | "eyes";

interface MouseEnt {
  x: number;
  y: number;
  dir: Dir;
  want: Dir;
  speed: number;
  anim: number;
}
interface Robot {
  name: (typeof ROBOT_DEFS)[number]["name"];
  color: string;
  x: number;
  y: number;
  dir: Dir;
  mode: RobotMode;
  releaseAt: number;
  speed: number;
}

const HI_KEY = "mmrcClassicHi";

export function ClassicMaze() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const scoreRef = useRef<HTMLSpanElement>(null);
  const hiRef = useRef<HTMLSpanElement>(null);
  const levelRef = useRef<HTMLSpanElement>(null);
  const livesRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const ovTitleRef = useRef<HTMLHeadingElement>(null);
  const ovTextRef = useRef<HTMLParagraphElement>(null);
  const startBtnRef = useRef<HTMLButtonElement>(null);
  const muteBtnRef = useRef<HTMLButtonElement>(null);
  const pauseBtnRef = useRef<HTMLButtonElement>(null);
  const fullscreenBtnRef = useRef<HTMLButtonElement>(null);
  const pauseMenuRef = useRef<HTMLDivElement>(null);
  const resumeBtnRef = useRef<HTMLButtonElement>(null);
  const restartBtnRef = useRef<HTMLButtonElement>(null);
  const exitBtnRef = useRef<HTMLButtonElement>(null);
  const liveRef = useRef<HTMLDivElement>(null);
  const dpadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      !canvasRef.current ||
      !stageRef.current ||
      !wrapRef.current ||
      !overlayRef.current ||
      !ovTitleRef.current ||
      !ovTextRef.current ||
      !startBtnRef.current ||
      !muteBtnRef.current ||
      !pauseBtnRef.current ||
      !fullscreenBtnRef.current ||
      !pauseMenuRef.current ||
      !resumeBtnRef.current ||
      !restartBtnRef.current ||
      !exitBtnRef.current ||
      !scoreRef.current ||
      !hiRef.current ||
      !levelRef.current ||
      !livesRef.current ||
      !canvasRef.current.getContext("2d")
    ) {
      return;
    }
    // Re-bound with explicit non-null types: TS's control-flow narrowing from
    // the guard above doesn't extend into the nested closures declared below.
    const canvas = canvasRef.current as HTMLCanvasElement;
    const stage = stageRef.current as HTMLDivElement;
    const wrap = wrapRef.current as HTMLDivElement;
    const overlay = overlayRef.current as HTMLDivElement;
    const ovTitle = ovTitleRef.current as HTMLHeadingElement;
    const ovText = ovTextRef.current as HTMLParagraphElement;
    const startBtn = startBtnRef.current as HTMLButtonElement;
    const muteBtn = muteBtnRef.current as HTMLButtonElement;
    const pauseBtn = pauseBtnRef.current as HTMLButtonElement;
    const fullscreenBtn = fullscreenBtnRef.current as HTMLButtonElement;
    const pauseMenu = pauseMenuRef.current as HTMLDivElement;
    const resumeBtn = resumeBtnRef.current as HTMLButtonElement;
    const restartBtn = restartBtnRef.current as HTMLButtonElement;
    const exitBtn = exitBtnRef.current as HTMLButtonElement;
    const scoreEl = scoreRef.current as HTMLSpanElement;
    const hiEl = hiRef.current as HTMLSpanElement;
    const lvlEl = levelRef.current as HTMLSpanElement;
    const livesEl = livesRef.current as HTMLDivElement;
    const liveEl = liveRef.current;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

    let disposed = false;
    const READY_TITLE = ovTitle.textContent ?? "Classic Maze";
    const READY_HTML = ovText.innerHTML;

    /* ---- maze state ---- */
    let maze: MazeGrid = buildMaze();
    let pelletsLeft = countPellets(maze);
    function resetMaze() {
      maze = buildMaze();
      pelletsLeft = countPellets(maze);
    }
    const wallAt = (r: number, c: number, forGhost: boolean) => isWall(maze, r, c, forGhost);

    /* ---- game state ---- */
    let score = 0;
    let hiscore = +(localStorage.getItem(HI_KEY) || 0);
    let lives = 3;
    let level = 1;
    let phase: Phase = "idle";
    let phaseT = 0;
    let frightT = 0;
    let eatChain = 0;
    let globalT = 0;

    const mouse: MouseEnt = { x: 0, y: 0, dir: "left", want: "left", speed: 0, anim: 0 };
    let robots: Robot[] = [];

    /**
     * Difficulty dials, tuned to make the Classic Maze a bit gentler:
     * a shallower per-level speed ramp, robots that trickle out of the house
     * more slowly, a longer scatter window before each chase, and cheese that
     * keeps them frightened for longer. See also ROBOT_SPEED_SCALE in shared.ts.
     */
    const LEVEL_SPEED_STEP = 0.1; // per level, capped at 5 levels
    const ROBOT_RELEASE_GAP = 4.5; // seconds between robots leaving the house
    const MODE_CYCLE = 27; // seconds per scatter/chase cycle
    const SCATTER_WINDOW = 10; // of those seconds spent scattering, not chasing

    function baseSpeed() {
      return (2.0 + Math.min(level - 1, 5) * LEVEL_SPEED_STEP) * GAME_SPEED_SCALE;
    }

    function resetActors(full: boolean) {
      const p = tileCenter(11, 9);
      mouse.x = p.x;
      mouse.y = p.y;
      mouse.dir = "left";
      mouse.want = "left";
      mouse.anim = 0;
      mouse.speed = baseSpeed() * MOUSE_SPEED_SCALE;
      robots = ROBOT_DEFS.map((d, i) => {
        const h = tileCenter(d.home.r, d.home.c);
        return {
          name: d.name,
          color: d.color,
          x: h.x,
          y: h.y,
          dir: d.house ? "up" : "left",
          mode: d.house ? "house" : "scatter",
          releaseAt: d.house ? i * ROBOT_RELEASE_GAP - (full ? 0 : 1.5) : 0,
          speed: baseSpeed() * ROBOT_SPEED_SCALE,
        };
      });
      frightT = 0;
      eatChain = 0;
    }

    function setPhase(s: Phase) {
      phase = s;
      phaseT = 0;
    }
    function updateHud() {
      scoreEl.textContent = String(score);
      hiEl.textContent = String(hiscore);
      lvlEl.textContent = String(level);
      livesEl.innerHTML = "";
      for (let i = 0; i < lives; i++) {
        const s = document.createElement("span");
        s.textContent = "🐭";
        s.style.fontSize = "16px";
        livesEl.appendChild(s);
      }
      if (liveEl) liveEl.textContent = `Score ${score}. Lives ${lives}. Level ${level}.`;
    }
    function addScore(n: number) {
      score += n;
      if (score > hiscore) {
        hiscore = score;
        localStorage.setItem(HI_KEY, String(hiscore));
      }
      updateHud();
    }

    function newGame() {
      score = 0;
      lives = 3;
      level = 1;
      resetMaze();
      resetActors(true);
      updateHud();
      setPhase("ready");
      sndStart();
    }
    function nextLevel() {
      level++;
      resetMaze();
      resetActors(true);
      updateHud();
      setPhase("ready");
    }

    function pauseGame() {
      if (phase !== "play") return;
      setPhase("paused");
      ovTitle.textContent = "Paused";
      ovText.innerHTML = "Game paused.<br><br>Resume, restart the mission, or exit to the menu.";
      startBtn.classList.add("hidden");
      pauseMenu.classList.remove("hidden");
      overlay.classList.remove("hidden");
    }
    function resumeGame() {
      if (phase !== "paused") return;
      overlay.classList.add("hidden");
      pauseMenu.classList.add("hidden");
      startBtn.classList.remove("hidden");
      setPhase("play");
    }
    function restartFromPause() {
      overlay.classList.add("hidden");
      pauseMenu.classList.add("hidden");
      startBtn.classList.remove("hidden");
      newGame();
    }
    function exitToMenu() {
      pauseMenu.classList.add("hidden");
      startBtn.classList.remove("hidden");
      ovTitle.textContent = READY_TITLE;
      ovText.innerHTML = READY_HTML;
      startBtn.textContent = "Start Mission";
      overlay.classList.remove("hidden");
      setPhase("idle");
    }

    /* ---- movement ---- */
    function canGo(e: { x: number; y: number }, dir: Dir, forGhost: boolean) {
      const t = entTile(e);
      const d = DIRS[dir];
      return !wallAt(t.r + d.y, t.c + d.x, forGhost);
    }
    function stepEntity(e: MouseEnt | Robot, forGhost: boolean, chooseDir?: () => void) {
      advance(e, (dir) => canGo(e, dir, forGhost), chooseDir);
    }

    /* ---- robot AI ---- */
    function robotTarget(rb: Robot) {
      const mt = entTile(mouse);
      if (rb.mode === "eyes") return { r: 7, c: 9 };
      if (rb.mode === "scatter") {
        return { REX: { r: 1, c: 17 }, VOLT: { r: 1, c: 1 }, CYBER: { r: 19, c: 17 }, SERVO: { r: 19, c: 1 } }[rb.name];
      }
      const d = DIRS[mouse.dir];
      switch (rb.name) {
        case "REX":
          return mt;
        case "VOLT":
          return { r: mt.r + d.y * 4, c: mt.c + d.x * 4 };
        case "CYBER": {
          const rex = robots[0]!;
          const rt = entTile(rex);
          return { r: mt.r + (mt.r - rt.r), c: mt.c + (mt.c - rt.c) };
        }
        case "SERVO": {
          const rt = entTile(rb);
          const dist = Math.hypot(rt.r - mt.r, rt.c - mt.c);
          return dist > 6 ? mt : { r: 19, c: 1 };
        }
      }
    }
    function updateRobot(rb: Robot, dt: number) {
      // The side-tunnel slowdown that used to apply on row 9 is gone with the
      // tunnel itself — that row is now ordinary enclosed corridor.
      rb.speed = baseSpeed() * (rb.mode === "eyes" ? 1.6 : rb.mode === "fright" ? 0.55 : ROBOT_SPEED_SCALE);

      if (rb.mode === "house") {
        rb.releaseAt -= dt;
        rb.y += Math.sin(globalT * 6 + rb.name.length) * 0.3;
        if (rb.releaseAt <= 0) rb.mode = "exit";
        return;
      }
      if (rb.mode === "exit") {
        const door = tileCenter(7, 9);
        if (Math.abs(rb.x - door.x) > 1.5) {
          rb.x += Math.sign(door.x - rb.x) * 1.2;
        } else {
          rb.x = door.x;
          rb.y -= 1.2;
          if (rb.y <= door.y) {
            rb.y = door.y;
            rb.mode = frightT > 0 ? "fright" : modeNow();
            rb.dir = "left";
          }
        }
        return;
      }
      if (rb.mode === "eyes") {
        // Reaching the door tile at all is enough — eyes travel fast enough
        // that requiring them to land exactly on its centre can be missed.
        const t2 = entTile(rb);
        if (t2.r === 7 && t2.c === 9) {
          rb.mode = "house";
          rb.releaseAt = 2;
          const h = tileCenter(9, 9);
          rb.x = h.x;
          rb.y = h.y;
          return;
        }
      }

      // Runs from inside stepEntity at the instant the robot lands on a tile
      // centre, which is the only point where changing direction is legal.
      stepEntity(rb, rb.mode === "eyes", () => {
        const here = entTile(rb);
        const choices: Dir[] = [];
        for (const dir of ["up", "left", "down", "right"] as Dir[]) {
          if (dir === OPP[rb.dir]) continue;
          if (canGo(rb, dir, rb.mode === "eyes")) choices.push(dir);
        }
        if (!choices.length) rb.dir = OPP[rb.dir];
        else if (rb.mode === "fright") {
          rb.dir = choices[Math.floor(Math.random() * choices.length)]!;
        } else {
          const tgt = robotTarget(rb)!;
          let best = choices[0]!;
          let bd = 1e9;
          for (const dir of choices) {
            const d = DIRS[dir];
            const nr = here.r + d.y;
            const nc = here.c + d.x;
            const dist = (nr - tgt.r) ** 2 + (nc - tgt.c) ** 2;
            if (dist < bd) {
              bd = dist;
              best = dir;
            }
          }
          rb.dir = best;
        }
      });
    }
    function modeNow(): "scatter" | "chase" {
      const cycle = globalT % MODE_CYCLE;
      return cycle < SCATTER_WINDOW ? "scatter" : "chase";
    }

    /* ---- update ---- */
    function update(dt: number) {
      globalT += dt;
      mouse.anim += dt * 10;
      mouse.speed = baseSpeed() * MOUSE_SPEED_SCALE * (frightT > 0 ? 1.08 : 1);
      // Doubling back is legal anywhere in a corridor, not just at a centre —
      // the mouse came from that direction, so it is guaranteed to be open.
      if (mouse.want === OPP[mouse.dir]) mouse.dir = mouse.want;
      stepEntity(mouse, false, () => {
        if (mouse.want !== mouse.dir && canGo(mouse, mouse.want, false)) mouse.dir = mouse.want;
      });

      const t = entTile(mouse);
      const cell = maze[t.r]?.[t.c];
      if (cell === "." || cell === "o") {
        maze[t.r]![t.c] = " ";
        pelletsLeft--;
        if (cell === ".") {
          addScore(10);
          sndMunch();
        } else {
          addScore(50);
          sndCheese();
          frightT = Math.max(8 - level * 0.4, 5);
          eatChain = 0;
          for (const rb of robots) if (rb.mode === "scatter" || rb.mode === "chase" || rb.mode === "fright") { rb.mode = "fright"; rb.dir = OPP[rb.dir]; }
        }
        if (pelletsLeft <= 0) {
          sndLevel();
          setPhase("levelup");
          return;
        }
      }

      if (frightT > 0) {
        frightT -= dt;
        if (frightT <= 0) for (const rb of robots) if (rb.mode === "fright") rb.mode = modeNow();
      }

      const mn = modeNow();
      for (const rb of robots) {
        if ((rb.mode === "scatter" || rb.mode === "chase") && rb.mode !== mn) {
          rb.mode = mn;
          rb.dir = OPP[rb.dir];
        }
        updateRobot(rb, dt);
      }

      for (const rb of robots) {
        if (Math.hypot(rb.x - mouse.x, rb.y - mouse.y) < TILE * 0.6) {
          if (rb.mode === "fright") {
            eatChain++;
            addScore(200 * Math.pow(2, eatChain - 1));
            sndEatRobot();
            rb.mode = "eyes";
          } else if (rb.mode !== "eyes" && rb.mode !== "house" && rb.mode !== "exit") {
            lives--;
            updateHud();
            sndDeath();
            setPhase("dying");
            return;
          }
        }
      }
    }
    function gameOver() {
      setPhase("over");
      // Hands the final run to the <Leaderboard> component, which owns the
      // name-entry form and the score submission (see src/lib/leaderboard.ts).
      window.dispatchEvent(
        new CustomEvent<GameOverDetail>(GAME_OVER_EVENT, { detail: { mode: "classic", score, level } }),
      );
      ovTitle.textContent = "System Failure";
      ovText.innerHTML = `The robots caught the mouse! 🤖<br><br>Final score: <b style="color:${GOLD}">${score}</b> &nbsp;·&nbsp; High score: <b>${hiscore}</b>`;
      startBtn.textContent = "Reboot Mission";
      overlay.classList.remove("hidden");
    }

    /* ---- render ---- */
    function banner(txt: string, color: string) {
      ctx.save();
      ctx.font = "bold 26px 'Segoe UI',sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 18;
      ctx.fillText(txt, canvas.width / 2, 9.5 * TILE);
      ctx.restore();
    }
    /**
     * Draws the walls as one continuous barrier outline rather than as a set of
     * per-tile boxes.
     *
     * Each wall tile strokes only the faces that border open space, and a face
     * runs all the way to the tile edge wherever the wall carries on into the
     * neighbouring tile — so neighbouring tiles' strokes meet end to end and a
     * run of wall reads as a single unbroken barrier. Where a face turns a
     * corner instead, it stops at the inset and meets the perpendicular face at
     * the same point.
     *
     * Inner (concave) bends need their own short elbow: if a tile has wall above
     * and wall to the left but open space on the diagonal between them, neither
     * neighbour's stroke reaches the bend, and without the elbow the outline
     * would break there.
     *
     * The whole thing is one path stroked once, so the neon glow is uniform
     * instead of stacking up where tiles overlap.
     */
    function drawMazeLayer() {
      const IN = 4; // inset of the barrier line from the tile edge
      // Outside the grid counts as open space, so the outer wall is outlined on
      // both faces and frames the maze.
      const solid = (r: number, c: number) =>
        r >= 0 && r < ROWS && c >= 0 && c < COLS && maze[r]![c] === "#";

      ctx.save();
      ctx.strokeStyle = "rgba(190,105,232,0.95)";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowColor = NEON;
      ctx.shadowBlur = 9;
      ctx.beginPath();

      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++) {
          if (!solid(r, c)) continue;
          const x = c * TILE;
          const y = r * TILE;
          const up = solid(r - 1, c);
          const down = solid(r + 1, c);
          const left = solid(r, c - 1);
          const right = solid(r, c + 1);

          if (!up) {
            ctx.moveTo(x + (left ? 0 : IN), y + IN);
            ctx.lineTo(x + TILE - (right ? 0 : IN), y + IN);
          }
          if (!down) {
            ctx.moveTo(x + (left ? 0 : IN), y + TILE - IN);
            ctx.lineTo(x + TILE - (right ? 0 : IN), y + TILE - IN);
          }
          if (!left) {
            ctx.moveTo(x + IN, y + (up ? 0 : IN));
            ctx.lineTo(x + IN, y + TILE - (down ? 0 : IN));
          }
          if (!right) {
            ctx.moveTo(x + TILE - IN, y + (up ? 0 : IN));
            ctx.lineTo(x + TILE - IN, y + TILE - (down ? 0 : IN));
          }

          if (up && left && !solid(r - 1, c - 1)) {
            ctx.moveTo(x + IN, y);
            ctx.lineTo(x + IN, y + IN);
            ctx.lineTo(x, y + IN);
          }
          if (up && right && !solid(r - 1, c + 1)) {
            ctx.moveTo(x + TILE - IN, y);
            ctx.lineTo(x + TILE - IN, y + IN);
            ctx.lineTo(x + TILE, y + IN);
          }
          if (down && left && !solid(r + 1, c - 1)) {
            ctx.moveTo(x + IN, y + TILE);
            ctx.lineTo(x + IN, y + TILE - IN);
            ctx.lineTo(x, y + TILE - IN);
          }
          if (down && right && !solid(r + 1, c + 1)) {
            ctx.moveTo(x + TILE - IN, y + TILE);
            ctx.lineTo(x + TILE - IN, y + TILE - IN);
            ctx.lineTo(x + TILE, y + TILE - IN);
          }
        }
      ctx.stroke();

      // Robot house door: a gold bar across the gap in the barrier.
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 3;
      ctx.shadowColor = GOLD;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++) {
          if (maze[r]![c] !== "-") continue;
          ctx.moveTo(c * TILE + 3, r * TILE + TILE / 2);
          ctx.lineTo(c * TILE + TILE - 3, r * TILE + TILE / 2);
        }
      ctx.stroke();
      ctx.restore();
    }
    function drawCheese(x: number, y: number, s: number) {
      ctx.save();
      ctx.translate(x, y);
      ctx.shadowColor = GOLD;
      ctx.shadowBlur = 10;
      ctx.fillStyle = "#FFC93C";
      ctx.beginPath();
      ctx.moveTo(-s, s * 0.6);
      ctx.lineTo(s, s * 0.6);
      ctx.lineTo(s * 0.7, -s * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#e0a90f";
      ctx.beginPath();
      ctx.arc(-s * 0.2, s * 0.15, s * 0.16, 0, 7);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(s * 0.35, s * 0.25, s * 0.13, 0, 7);
      ctx.fill();
      ctx.restore();
    }
    function drawPellets() {
      const pulse = 1 + Math.sin(globalT * 5) * 0.15;
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++) {
          const t = maze[r]![c];
          const p = tileCenter(r, c);
          if (t === ".") {
            ctx.fillStyle = "#ffd76e";
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2.4, 0, 7);
            ctx.fill();
          } else if (t === "o") {
            drawCheese(p.x, p.y, 8 * pulse);
          }
        }
    }
    function drawMouse() {
      const { x, y } = mouse;
      const ang = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[mouse.dir];
      const wig = Math.sin(mouse.anim) * 0.15;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.strokeStyle = "#e8a0b4";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-9, 0);
      ctx.quadraticCurveTo(-16, Math.sin(mouse.anim * 1.4) * 6, -21, Math.sin(mouse.anim * 1.4 + 1) * 4);
      ctx.stroke();
      ctx.fillStyle = "#b9c4cf";
      ctx.beginPath();
      ctx.ellipse(0, 0, 10, 7.5, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = "#9aa7b3";
      ctx.beginPath();
      ctx.arc(3, -7, 4.2, 0, 7);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(3, 7, 4.2, 0, 7);
      ctx.fill();
      ctx.fillStyle = "#f2b8c6";
      ctx.beginPath();
      ctx.arc(3, -7, 2.2, 0, 7);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(3, 7, 2.2, 0, 7);
      ctx.fill();
      ctx.fillStyle = "#b9c4cf";
      ctx.beginPath();
      ctx.moveTo(6, -5);
      ctx.quadraticCurveTo(14, wig * 8, 6, 5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ff8fa8";
      ctx.beginPath();
      ctx.arc(12.2, wig * 6, 1.6, 0, 7);
      ctx.fill();
      ctx.fillStyle = "#101820";
      ctx.beginPath();
      ctx.arc(6, -2.5, 1.4, 0, 7);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(6, 2.5, 1.4, 0, 7);
      ctx.fill();
      ctx.strokeStyle = "rgba(230,240,250,.8)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(10, -1);
      ctx.lineTo(16, -4);
      ctx.moveTo(10, 0);
      ctx.lineTo(17, 0);
      ctx.moveTo(10, 1);
      ctx.lineTo(16, 4);
      ctx.stroke();
      ctx.restore();
    }
    function drawRobot(rb: Robot) {
      const { x, y } = rb;
      const fr = rb.mode === "fright";
      const flash = fr && frightT < 2 && Math.floor(frightT * 6) % 2 === 0;
      const body = rb.mode === "eyes" ? null : flash ? "#dfeeff" : fr ? "#2438b8" : rb.color;
      ctx.save();
      ctx.translate(x, y);
      if (body) {
        ctx.shadowColor = body;
        ctx.shadowBlur = 8;
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.arc(0, -2, 9, Math.PI, 0);
        ctx.lineTo(9, 8);
        for (let i = 0; i < 4; i++) ctx.lineTo(9 - 4.5 * (i + 0.5), i % 2 ? 8 : 5.5);
        ctx.lineTo(-9, 8);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = body;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(0, -11);
        ctx.lineTo(0, -15);
        ctx.stroke();
        ctx.fillStyle = flash ? "#862633" : "#fff";
        ctx.beginPath();
        ctx.arc(0, -16, 2, 0, 7);
        ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,.28)";
        ctx.fillRect(-5, 1, 10, 4);
        ctx.fillStyle = fr ? "#8fa2ff" : "#fff";
        ctx.fillRect(-4, 2, 2.4, 2);
        ctx.fillRect(-0.5, 2, 2.4, 2);
      }
      const d = DIRS[rb.dir] || { x: 0, y: 0 };
      for (const side of [-3.5, 3.5]) {
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.ellipse(side, fr ? -3 : -4, 2.8, 3.2, 0, 0, 7);
        ctx.fill();
        ctx.fillStyle = fr ? "#2438b8" : "#0a2540";
        ctx.beginPath();
        ctx.arc(side + d.x * 1.4, (fr ? -3 : -4) + d.y * 1.4, 1.5, 0, 7);
        ctx.fill();
      }
      if (fr && !flash) {
        ctx.strokeStyle = "#8fa2ff";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-5, 3);
        for (let i = 0; i < 5; i++) ctx.lineTo(-5 + i * 2.5, i % 2 ? 1.6 : 3.4);
        ctx.stroke();
      }
      ctx.restore();
    }
    function drawDeath() {
      const n = Math.floor(phaseT * 12);
      ctx.save();
      ctx.translate(mouse.x, mouse.y);
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + n * 0.4;
        const r1 = 6 + n;
        const r2 = 12 + n * 1.5;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
        ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
        ctx.stroke();
      }
      ctx.restore();
    }
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawMazeLayer();
      drawPellets();
      for (const rb of robots) drawRobot(rb);
      if (phase !== "dying" || Math.floor(phaseT * 10) % 2 === 0 || phaseT < 0.1) drawMouse();
      if (phase === "dying") drawDeath();
      if (phase === "ready") banner("GET READY!", GOLD);
      else if (phase === "levelup") banner("SECTOR CLEARED!", "#4dff88");
    }

    /* ---- loop ---- */
    let last = performance.now();
    let rafId = 0;
    function loop(now: number) {
      if (disposed) return;
      rafId = requestAnimationFrame(loop);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      phaseT += dt;
      if (phase === "play") update(dt);
      if (phase === "ready" && phaseT > 1.6) setPhase("play");
      if (phase === "dying" && phaseT > 1.6) {
        if (lives <= 0) gameOver();
        else {
          resetActors(false);
          setPhase("ready");
        }
      }
      if (phase === "levelup" && phaseT > 2) nextLevel();
      draw();
    }

    /* ---- input ---- */
    const keyMap: Record<string, Dir> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right", W: "up", S: "down", A: "left", D: "right" };
    function handleKeydown(e: KeyboardEvent) {
      // Let the player type in the leaderboard name field without the game
      // eating the keystroke (or Enter restarting the run).
      if (isTypingTarget(e.target)) return;
      const dir = keyMap[e.key];
      if (dir) {
        e.preventDefault();
        mouse.want = dir;
      }
      if ((e.key === " " || e.key === "Enter") && phase === "over") startBtn.click();
      // "p" is a second pause key for fullscreen play: the browser consumes Esc
      // to leave fullscreen, so it never reaches this handler there (the
      // fullscreenchange handler pauses in that case).
      if (e.key === "Escape" || e.key === "p" || e.key === "P") {
        if (phase === "play") pauseGame();
        else if (phase === "paused") resumeGame();
      }
    }
    let touchStart: { x: number; y: number } | null = null;
    function handleTouchStart(e: TouchEvent) {
      const t = e.touches[0];
      if (!t) return;
      touchStart = { x: t.clientX, y: t.clientY };
      audioInit();
    }
    function handleTouchMove(e: TouchEvent) {
      const t = e.touches[0];
      if (!touchStart || !t) return;
      const dx = t.clientX - touchStart.x;
      const dy = t.clientY - touchStart.y;
      if (Math.hypot(dx, dy) > 24) {
        mouse.want = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
        touchStart = { x: t.clientX, y: t.clientY };
      }
    }
    window.addEventListener("keydown", handleKeydown);
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });

    function handleStart() {
      audioInit();
      overlay.classList.add("hidden");
      newGame();
    }
    function handleMute() {
      const m = toggleMute();
      muteBtn.textContent = m ? "🔇" : "🔊";
    }
    function handlePauseToggle() {
      if (phase === "play") pauseGame();
      else if (phase === "paused") resumeGame();
    }
    // Fullscreen targets the whole stage (score bar + board + touch pad), not
    // just the canvas wrapper — going fullscreen on the wrapper alone dropped
    // the HUD and pinned the board to the top-left corner of the screen.
    function isFullscreen() {
      return document.fullscreenElement === stage;
    }
    function handleFullscreenToggle() {
      if (isFullscreen()) {
        document.exitFullscreen();
      } else {
        stage.requestFullscreen().catch(() => {});
      }
    }
    function handleFullscreenChange() {
      fullscreenBtn.textContent = isFullscreen() ? "⤢" : "⛶";
      // Leaving fullscreen mid-game is almost always the player hitting Esc,
      // which the browser consumes before the keydown handler can pause. Pause
      // for them so Esc means "pause" in both windowed and fullscreen play.
      if (!isFullscreen() && phase === "play") pauseGame();
      fit();
    }
    startBtn.addEventListener("click", handleStart);
    muteBtn.addEventListener("click", handleMute);
    muteBtn.textContent = isMuted() ? "🔇" : "🔊";
    pauseBtn.addEventListener("click", handlePauseToggle);
    fullscreenBtn.addEventListener("click", handleFullscreenToggle);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    resumeBtn.addEventListener("click", resumeGame);
    restartBtn.addEventListener("click", restartFromPause);
    exitBtn.addEventListener("click", exitToMenu);

    const dpad = dpadRef.current;
    function dpadHandler(this: HTMLElement) {
      const dir = this.dataset.dir as Dir;
      mouse.want = dir;
      audioInit();
    }
    const dpadButtons = dpad ? Array.from(dpad.querySelectorAll<HTMLButtonElement>("button")) : [];
    for (const b of dpadButtons) b.addEventListener("click", dpadHandler);

    function fit() {
      const fullscreen = isFullscreen();
      const availW = fullscreen ? window.innerWidth * 0.98 : Math.min(window.innerWidth * 0.94, 700);
      // In fullscreen the board shares the screen with the score bar and touch
      // pad, so subtract their measured heights. Deriving this from the stage's
      // own height does not work: the stage is sized to the whole screen in
      // fullscreen, which would count all the leftover space as chrome and keep
      // the board pinned at its small windowed size.
      const chrome = fullscreen
        ? (hudRef.current?.offsetHeight ?? 0) + (dpadRef.current?.offsetHeight ?? 0) + 32
        : 0;
      const availH = fullscreen
        ? window.innerHeight - chrome
        : window.innerHeight - wrap.getBoundingClientRect().top - 40;
      const cap = fullscreen ? 3 : 1.5;
      const s = Math.min(availW / 456, availH / 504, cap);
      canvas.style.width = 456 * s + "px";
      canvas.style.height = 504 * s + "px";
    }
    window.addEventListener("resize", fit);
    fit();

    resetMaze();
    resetActors(true);
    updateHud();
    rafId = requestAnimationFrame(loop);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("resize", fit);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      startBtn.removeEventListener("click", handleStart);
      muteBtn.removeEventListener("click", handleMute);
      pauseBtn.removeEventListener("click", handlePauseToggle);
      fullscreenBtn.removeEventListener("click", handleFullscreenToggle);
      resumeBtn.removeEventListener("click", resumeGame);
      restartBtn.removeEventListener("click", restartFromPause);
      exitBtn.removeEventListener("click", exitToMenu);
      for (const b of dpadButtons) b.removeEventListener("click", dpadHandler);
    };
  }, []);

  return (
    <div ref={stageRef} className="game-stage mx-auto flex flex-col items-center">
      <div ref={hudRef} className="flex w-full max-w-[700px] items-center justify-between px-1 py-2 font-mono text-sm">
        <div>
          SCORE <span ref={scoreRef} data-testid="classic-score" className="text-[#F2A900]">0</span>
        </div>
        <div>
          HI <span ref={hiRef} className="text-[#F2A900]">0</span>
        </div>
        <div>
          LVL <span ref={levelRef} className="text-[#F2A900]">1</span>
        </div>
        <div ref={livesRef} className="flex items-center gap-1" />
      </div>

      <div ref={wrapRef} className="relative leading-none">
        <canvas ref={canvasRef} width={456} height={504} role="application" aria-label="Classic Maze game" className="rounded-lg border-2 border-ras-purple bg-[#140b1e] shadow-[0_0_30px_rgba(95,33,103,.45)]" />
        <button ref={pauseBtnRef} type="button" title="Pause (Esc)" className="absolute right-24 top-2 h-9 w-9 rounded-md border border-ras-purple/40 bg-black/40 text-lg">
          ⏸
        </button>
        <button ref={fullscreenBtnRef} type="button" title="Fullscreen" className="absolute right-12 top-2 h-9 w-9 rounded-md border border-ras-purple/40 bg-black/40 text-lg">
          ⛶
        </button>
        <button ref={muteBtnRef} type="button" title="Mute" className="absolute right-2 top-2 h-9 w-9 rounded-md border border-ras-purple/40 bg-black/40 text-lg">
          🔊
        </button>
        <div ref={overlayRef} className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-black/85 p-5 text-center">
          <div className="text-5xl">🐭</div>
          <h2 ref={ovTitleRef} className="font-display text-2xl font-bold uppercase tracking-widest text-[#F2A900]">
            Classic Maze
          </h2>
          <p ref={ovTextRef} className="max-w-sm text-sm text-white/80">
            Guide the mouse through the maze! Collect crumbs, grab <b>cheese</b> to overclock and chase the robots.
            <br />
            <br />
            Arrow keys or WASD &mdash; swipe or use the on-screen pad on touch screens.
            <br />
            <b>Esc</b> or <b>P</b> to pause &middot; <b>⛶</b> for fullscreen.
          </p>
          <button ref={startBtnRef} type="button" className="rounded-full border-2 border-[#F2A900] bg-ras-crimson px-8 py-3 text-sm font-bold uppercase tracking-widest text-white">
            Start Mission
          </button>
          <div ref={pauseMenuRef} className="hidden flex flex-col gap-2">
            <button ref={resumeBtnRef} type="button" className="rounded-full border-2 border-[#F2A900] bg-ras-crimson px-8 py-2 text-sm font-bold uppercase tracking-widest text-white">
              Resume
            </button>
            <button ref={restartBtnRef} type="button" className="rounded-full border border-ras-purple/60 bg-black/40 px-8 py-2 text-sm font-bold uppercase tracking-widest text-white">
              Restart
            </button>
            <button ref={exitBtnRef} type="button" className="rounded-full border border-ras-purple/60 bg-black/40 px-8 py-2 text-sm font-bold uppercase tracking-widest text-white">
              Exit to menu
            </button>
          </div>
        </div>
      </div>

      <div ref={dpadRef} className="mt-3 grid w-fit grid-cols-3 grid-rows-3 gap-2 sm:hidden">
        <button type="button" data-dir="up" aria-label="Up" className="col-start-2 row-start-1 h-11 w-11 rounded-md border border-ras-purple/40 bg-[var(--color-surface)] font-bold">↑</button>
        <button type="button" data-dir="left" aria-label="Left" className="col-start-1 row-start-2 h-11 w-11 rounded-md border border-ras-purple/40 bg-[var(--color-surface)] font-bold">←</button>
        <button type="button" data-dir="right" aria-label="Right" className="col-start-3 row-start-2 h-11 w-11 rounded-md border border-ras-purple/40 bg-[var(--color-surface)] font-bold">→</button>
        <button type="button" data-dir="down" aria-label="Down" className="col-start-2 row-start-3 h-11 w-11 rounded-md border border-ras-purple/40 bg-[var(--color-surface)] font-bold">↓</button>
      </div>

      <div ref={liveRef} className="sr-only-live" aria-live="polite" />
    </div>
  );
}
