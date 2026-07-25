"use client";

import { useEffect, useRef } from "react";
import {
  ROWS,
  COLS,
  DIRS,
  OPP,
  ROBOT_DEFS,
  buildMaze,
  countPellets,
  isTypingTarget,
  GAME_SPEED_SCALE,
  MOUSE_SPEED_SCALE,
  GOLD,
  type Dir,
  type MazeGrid,
} from "./shared";
import { audioInit, sndMunch, sndCheese, sndEatRobot, sndDeath, sndLevel, sndStart, isMuted, toggleMute } from "./audio";
import { GAME_OVER_EVENT, type GameOverDetail } from "@/lib/leaderboard";

type Phase = "idle" | "ready" | "play" | "paused" | "dying" | "levelup" | "over";
type BotMode = "house" | "exit" | "active" | "fright" | "eyes";

interface Bot {
  name: (typeof ROBOT_DEFS)[number]["name"];
  color: string;
  x: number;
  y: number;
  dir: Dir;
  mode: BotMode;
  rel: number;
}

const HI_KEY = "mmrcFpHi";
const W = 640;
const H = 400;
const NUM = 320;
const COLW = 2;
const FOV = Math.PI / 3;
const THALF = Math.tan(FOV / 2);
const MS = 5; // minimap tile size

// Distances are plain differences: the maze is fully enclosed, so there is no
// side tunnel that would make the short way round the grid the real distance.

export function FirstPerson() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

  useEffect(() => {
    if (
      !canvasRef.current ||
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
    const READY_TITLE = ovTitle.textContent ?? "Mouse-Eye View";
    const READY_HTML = ovText.innerHTML;

    /* ---- world ---- */
    let grid: MazeGrid = buildMaze();
    let dotsLeft = countPellets(grid);
    function resetGrid() {
      grid = buildMaze();
      dotsLeft = countPellets(grid);
    }
    function cellAt(r: number, c: number): string {
      // Solid outside the grid on both axes — the maze is enclosed, so nothing
      // can walk off one side and reappear on the other.
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return "#";
      return grid[r]![c] ?? "#";
    }
    function solid(r: number, c: number, forGhost: boolean) {
      const t = cellAt(r, c);
      return t === "#" || (t === "-" && !forGhost);
    }

    /* ---- state ---- */
    let score = 0;
    let hi = +(localStorage.getItem(HI_KEY) || 0);
    let lives = 3;
    let level = 1;
    let phase: Phase = "idle";
    let phaseT = 0;
    let gT = 0;
    let frT = 0;
    let frMax = 1;
    let chain = 0;
    const P = { x: 9.5, y: 11.5, a: -Math.PI / 2 };
    let bots: Bot[] = [];
    const zbuf = new Float32Array(NUM);

    function baseSp() {
      return 1.9 + Math.min(level - 1, 5) * 0.12;
    }
    function resetBots(full: boolean) {
      bots = ROBOT_DEFS.map((d, i) => ({
        name: d.name,
        color: d.color,
        x: d.home.c + 0.5,
        y: d.home.r + 0.5,
        dir: (d.house ? "up" : "left") as Dir,
        mode: (d.house ? "house" : "active") as BotMode,
        rel: d.house ? 4 + i * 3.5 - (full ? 0 : 2) : 0,
      }));
    }
    function resetPos(full: boolean) {
      P.x = 9.5;
      P.y = 11.5;
      P.a = -Math.PI / 2;
      resetBots(full);
      frT = 0;
      chain = 0;
    }
    function hud() {
      scoreEl.textContent = String(score);
      hiEl.textContent = String(hi);
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
    function addPts(n: number) {
      score += n;
      if (score > hi) {
        hi = score;
        localStorage.setItem(HI_KEY, String(hi));
      }
      hud();
    }

    /* ---- input ---- */
    const keys: Record<string, boolean> = {};
    function handleKeydown(e: KeyboardEvent) {
      // Let the player type in the leaderboard name field without the game
      // eating the keystroke (or Enter restarting the run). Deliberately not
      // applied to keyup, so a key held when focus moves still gets released.
      if (isTypingTarget(e.target)) return;
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
        e.preventDefault();
        keys[k] = true;
      }
      if ((e.key === " " || e.key === "Enter") && phase === "over") startBtn.click();
      // "p" is a second pause key for fullscreen play: the browser consumes Esc
      // to leave fullscreen, so it never reaches this handler there (the
      // fullscreenchange handler pauses in that case).
      if (e.key === "Escape" || k === "p") {
        if (phase === "play") pauseGame();
        else if (phase === "paused") resumeGame();
      }
    }
    function handleKeyup(e: KeyboardEvent) {
      keys[e.key.toLowerCase()] = false;
    }
    function handleCanvasClick() {
      if (phase === "play" && canvas.requestPointerLock) canvas.requestPointerLock();
    }
    function handleMouseMove(e: MouseEvent) {
      if (document.pointerLockElement === canvas && phase === "play") P.a += e.movementX * 0.0032;
    }
    let tPrev: { x: number; y: number } | null = null;
    function handleTouchStart(e: TouchEvent) {
      const t = e.touches[0];
      if (!t) return;
      tPrev = { x: t.clientX, y: t.clientY };
      audioInit();
    }
    function handleTouchMove(e: TouchEvent) {
      const t = e.touches[0];
      if (!tPrev || !t || phase !== "play") return;
      const dx = t.clientX - tPrev.x;
      const dy = t.clientY - tPrev.y;
      P.a += dx * 0.006;
      const fwd = -dy * 0.015;
      tryMove(Math.cos(P.a) * fwd, Math.sin(P.a) * fwd);
      tPrev = { x: t.clientX, y: t.clientY };
    }

    function hitWall(x: number, y: number) {
      const R = 0.26;
      for (const ox of [-R, R])
        for (const oy of [-R, R]) if (solid(Math.floor(y + oy), Math.floor(x + ox), false)) return true;
      return false;
    }
    function tryMove(dx: number, dy: number) {
      const nx = P.x + dx;
      const ny = P.y + dy;
      if (!hitWall(nx, P.y)) P.x = nx;
      if (!hitWall(P.x, ny)) P.y = ny;
    }
    function movePlayer(dt: number) {
      let rot = 0;
      if (keys["arrowleft"]) rot -= 1;
      if (keys["arrowright"]) rot += 1;
      P.a += rot * 2.7 * dt;
      let f = 0;
      let s = 0;
      if (keys["w"] || keys["arrowup"]) f += 1;
      if (keys["s"] || keys["arrowdown"]) f -= 1;
      if (keys["a"]) s -= 1;
      if (keys["d"]) s += 1;
      if (f || s) {
        const dx = Math.cos(P.a) * f + Math.cos(P.a + Math.PI / 2) * s;
        const dy = Math.sin(P.a) * f + Math.sin(P.a + Math.PI / 2) * s;
        const len = Math.hypot(dx, dy) || 1;
        const sp = ((3.3 + (frT > 0 ? 0.4 : 0)) * GAME_SPEED_SCALE * MOUSE_SPEED_SCALE * dt) / len;
        tryMove(dx * sp, dy * sp);
      }
    }

    /* ---- robot AI ---- */
    function botTarget(b: Bot) {
      const mt = { r: Math.floor(P.y), c: Math.floor(P.x) };
      if (b.mode === "eyes") return { r: 7, c: 9 };
      const scatter = gT % 26 < 7;
      switch (b.name) {
        case "REX":
          return mt;
        case "VOLT":
          return { r: mt.r + Math.round(Math.sin(P.a)) * 3, c: mt.c + Math.round(Math.cos(P.a)) * 3 };
        case "CYBER":
          return scatter ? { r: 1, c: 17 } : mt;
        case "SERVO": {
          const d = Math.hypot(b.y - P.y, b.x - P.x);
          return d > 6 ? mt : { r: 19, c: 1 };
        }
      }
    }
    function updBot(b: Bot, dt: number) {
      const sp = baseSp() * (b.mode === "eyes" ? 1.7 : b.mode === "fright" ? 0.55 : 0.82);
      if (b.mode === "house") {
        b.rel -= dt;
        if (b.rel <= 0) b.mode = "exit";
        return;
      }
      if (b.mode === "exit") {
        if (Math.abs(b.x - 9.5) > 0.06) {
          b.x += Math.sign(9.5 - b.x) * 1.5 * dt;
        } else {
          b.x = 9.5;
          b.y -= 1.5 * dt;
          if (b.y <= 7.5) {
            b.y = 7.5;
            b.mode = frT > 0 ? "fright" : "active";
            b.dir = "left";
          }
        }
        return;
      }
      const cr = Math.floor(b.y);
      const cc = Math.floor(b.x);
      if (b.mode === "eyes" && cr === 7 && cc === 9 && Math.abs(b.x - 9.5) < 0.1 && Math.abs(b.y - 7.5) < 0.1) {
        b.mode = "house";
        b.rel = 2;
        b.x = 9.5;
        b.y = 9.5;
        return;
      }
      const cx = cc + 0.5;
      const cy = cr + 0.5;
      if (Math.abs(b.x - cx) < 0.07 && Math.abs(b.y - cy) < 0.07) {
        b.x = cx;
        b.y = cy;
        const choices: Dir[] = [];
        for (const dir of ["up", "left", "down", "right"] as Dir[]) {
          if (dir === OPP[b.dir]) continue;
          const d = DIRS[dir];
          if (!solid(cr + d.y, cc + d.x, b.mode === "eyes")) choices.push(dir);
        }
        if (!choices.length) b.dir = OPP[b.dir];
        else if (b.mode === "fright") b.dir = choices[Math.floor(Math.random() * choices.length)]!;
        else {
          const t = botTarget(b)!;
          let best = choices[0]!;
          let bd = 1e9;
          for (const dir of choices) {
            const d = DIRS[dir];
            const dist = (cr + d.y - t.r) ** 2 + (cc + d.x - t.c) ** 2;
            if (dist < bd) {
              bd = dist;
              best = dir;
            }
          }
          b.dir = best;
        }
      }
      const d = DIRS[b.dir];
      b.x += d.x * sp * dt;
      b.y += d.y * sp * dt;
    }

    /* ---- game update ---- */
    function upd(dt: number) {
      gT += dt;
      movePlayer(dt);
      const r = Math.floor(P.y);
      const c = Math.floor(P.x);
      const t = grid[r]?.[c];
      if (t === "." || t === "o") {
        grid[r]![c] = " ";
        dotsLeft--;
        if (t === ".") {
          addPts(10);
          sndMunch();
        } else {
          addPts(50);
          sndCheese();
          frMax = Math.max(7 - level * 0.5, 3.5);
          frT = frMax;
          chain = 0;
          for (const b of bots) if (b.mode === "active" || b.mode === "fright") { b.mode = "fright"; b.dir = OPP[b.dir]; }
        }
        if (dotsLeft <= 0) {
          sndLevel();
          phase = "levelup";
          phaseT = 0;
          return;
        }
      }
      if (frT > 0) {
        frT -= dt;
        if (frT <= 0) for (const b of bots) if (b.mode === "fright") b.mode = "active";
      }
      for (const b of bots) updBot(b, dt);
      for (const b of bots) {
        const d = Math.hypot(b.y - P.y, b.x - P.x);
        if (d < 0.55) {
          if (b.mode === "fright") {
            chain++;
            addPts(200 * Math.pow(2, chain - 1));
            sndEatRobot();
            b.mode = "eyes";
          } else if (b.mode === "active") {
            lives--;
            hud();
            sndDeath();
            phase = "dying";
            phaseT = 0;
            return;
          }
        }
      }
    }
    function over() {
      phase = "over";
      // Hands the final run to the <Leaderboard> component, which owns the
      // name-entry form and the score submission (see src/lib/leaderboard.ts).
      window.dispatchEvent(new CustomEvent<GameOverDetail>(GAME_OVER_EVENT, { detail: { mode: "fp", score, level } }));
      ovTitle.textContent = "System Failure";
      ovText.innerHTML = `The robots caught the mouse! 🤖<br><br>Final score: <b style="color:${GOLD}">${score}</b> &nbsp;·&nbsp; High score: <b>${hi}</b>`;
      startBtn.textContent = "Reboot Mission";
      overlay.classList.remove("hidden");
    }

    /* ---- sprites ---- */
    function mk(w: number, h: number, fn: (g: CanvasRenderingContext2D) => void) {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      fn(c.getContext("2d")!);
      return c;
    }
    function robotShape(g: CanvasRenderingContext2D, body: string | null, fr: boolean, flash: boolean) {
      if (body) {
        g.shadowColor = body;
        g.shadowBlur = 6;
        g.fillStyle = body;
        g.beginPath();
        g.arc(0, -2, 9, Math.PI, 0);
        g.lineTo(9, 8);
        for (let i = 0; i < 4; i++) g.lineTo(9 - 4.5 * (i + 0.5), i % 2 ? 8 : 5.5);
        g.lineTo(-9, 8);
        g.closePath();
        g.fill();
        g.shadowBlur = 0;
        g.strokeStyle = body;
        g.lineWidth = 1.6;
        g.beginPath();
        g.moveTo(0, -11);
        g.lineTo(0, -15);
        g.stroke();
        g.fillStyle = flash ? "#862633" : "#fff";
        g.beginPath();
        g.arc(0, -16, 2, 0, 7);
        g.fill();
        g.fillStyle = "rgba(0,0,0,.28)";
        g.fillRect(-5, 1, 10, 4);
        g.fillStyle = fr ? "#8fa2ff" : "#fff";
        g.fillRect(-4, 2, 2.4, 2);
        g.fillRect(-0.5, 2, 2.4, 2);
      }
      for (const side of [-3.5, 3.5]) {
        g.fillStyle = "#fff";
        g.beginPath();
        g.ellipse(side, -4, 2.8, 3.2, 0, 0, 7);
        g.fill();
        g.fillStyle = fr ? "#2438b8" : "#0a2540";
        g.beginPath();
        g.arc(side, -3.4, 1.5, 0, 7);
        g.fill();
      }
      if (fr && !flash) {
        g.strokeStyle = "#8fa2ff";
        g.lineWidth = 1.4;
        g.beginPath();
        g.moveTo(-5, 3);
        for (let i = 0; i < 5; i++) g.lineTo(-5 + i * 2.5, i % 2 ? 1.6 : 3.4);
        g.stroke();
      }
    }
    function robotSpr(color: string | null, fr: boolean, flash: boolean, eyesOnly = false) {
      return mk(64, 84, (g) => {
        g.translate(32, 52);
        g.scale(2.6, 2.6);
        robotShape(g, eyesOnly ? null : flash ? "#dfeeff" : fr ? "#2438b8" : color, fr, flash);
      });
    }
    const sprBody: Record<string, HTMLCanvasElement> = {};
    const sprFright = robotSpr(null, true, false);
    const sprFlash = robotSpr(null, true, true);
    const sprEyes = robotSpr(null, false, false, true);
    for (const d of ROBOT_DEFS) sprBody[d.name] = robotSpr(d.color, false, false);
    const dotImg = mk(16, 16, (g) => {
      const rg = g.createRadialGradient(8, 8, 1, 8, 8, 8);
      rg.addColorStop(0, "#fff2c4");
      rg.addColorStop(0.4, "#ffd76e");
      rg.addColorStop(1, "rgba(255,215,110,0)");
      g.fillStyle = rg;
      g.fillRect(0, 0, 16, 16);
    });
    const cheeseImg = mk(48, 48, (g) => {
      g.translate(24, 24);
      g.shadowColor = GOLD;
      g.shadowBlur = 8;
      g.fillStyle = "#FFC93C";
      g.beginPath();
      g.moveTo(-18, 11);
      g.lineTo(18, 11);
      g.lineTo(12.6, -12.6);
      g.closePath();
      g.fill();
      g.shadowBlur = 0;
      g.fillStyle = "#e0a90f";
      g.beginPath();
      g.arc(-3.6, 2.7, 2.9, 0, 7);
      g.fill();
      g.beginPath();
      g.arc(6.3, 4.5, 2.3, 0, 7);
      g.fill();
    });
    function botImg(b: Bot) {
      if (b.mode === "eyes") return sprEyes;
      if (b.mode === "fright") return frT < 2 && Math.floor(frT * 6) % 2 === 0 ? sprFlash : sprFright;
      return sprBody[b.name]!;
    }

    /* ---- rendering ---- */
    const ceilGrad = ctx.createLinearGradient(0, 0, 0, H / 2);
    ceilGrad.addColorStop(0, "#020609");
    ceilGrad.addColorStop(1, "#180b22");
    const floorGrad = ctx.createLinearGradient(0, H / 2, 0, H);
    floorGrad.addColorStop(0, "#140b1e");
    floorGrad.addColorStop(1, "#04090f");

    function render() {
      ctx.fillStyle = ceilGrad;
      ctx.fillRect(0, 0, W, H / 2);
      ctx.fillStyle = floorGrad;
      ctx.fillRect(0, H / 2, W, H / 2);
      const dirX = Math.cos(P.a);
      const dirY = Math.sin(P.a);
      const plX = -dirY * THALF;
      const plY = dirX * THALF;

      for (let i = 0; i < NUM; i++) {
        const camX = (2 * i) / NUM - 1;
        const rX = dirX + plX * camX;
        const rY = dirY + plY * camX;
        let mapX = Math.floor(P.x);
        let mapY = Math.floor(P.y);
        const dX = Math.abs(1 / (rX || 1e-9));
        const dY = Math.abs(1 / (rY || 1e-9));
        let stepX: number;
        let sideX: number;
        let stepY: number;
        let sideY: number;
        let side = 0;
        let tile = "#";
        let n = 0;
        if (rX < 0) {
          stepX = -1;
          sideX = (P.x - mapX) * dX;
        } else {
          stepX = 1;
          sideX = (mapX + 1 - P.x) * dX;
        }
        if (rY < 0) {
          stepY = -1;
          sideY = (P.y - mapY) * dY;
        } else {
          stepY = 1;
          sideY = (mapY + 1 - P.y) * dY;
        }
        while (n++ < 64) {
          if (sideX < sideY) {
            sideX += dX;
            mapX += stepX;
            side = 0;
          } else {
            sideY += dY;
            mapY += stepY;
            side = 1;
          }
          tile = cellAt(mapY, mapX);
          if (tile === "#" || tile === "-") break;
        }
        const dist = Math.max(0.05, side === 0 ? sideX - dX : sideY - dY);
        zbuf[i] = dist;
        const hh = Math.min(H * 2.2, H / dist);
        const y0 = H / 2 - hh / 2;
        const br = Math.max(0.1, 1 - dist / 11) * (side ? 0.72 : 1);
        if (tile === "-") ctx.fillStyle = `rgb(${(242 * br) | 0},${(169 * br) | 0},${(10 * br) | 0})`;
        else ctx.fillStyle = `rgb(${(95 * br) | 0},${(33 * br) | 0},${(103 * br) | 0})`;
        ctx.fillRect(i * COLW, y0, COLW, hh);
        ctx.fillStyle = `rgba(200,110,230,${(0.85 * br).toFixed(3)})`;
        ctx.fillRect(i * COLW, y0, COLW, 2);
        ctx.fillRect(i * COLW, y0 + hh - 2, COLW, 2);
      }
      drawSprites(dirX, dirY, plX, plY);
      drawMini();
      if (frT > 0) frightBar();
      if (phase === "ready") fpBanner("GET READY!", GOLD);
      if (phase === "levelup") fpBanner("SECTOR CLEARED!", "#4dff88");
      if (phase === "dying") {
        ctx.fillStyle = `rgba(228,0,43,${Math.min(0.55, phaseT * 0.6)})`;
        ctx.fillRect(0, 0, W, H);
        fpBanner("SQUEAK...!", "#ffb3c1");
      }
    }
    interface Sprite {
      x: number;
      y: number;
      img: HTMLCanvasElement;
      h: number;
      tx?: number;
      ty?: number;
    }
    function drawSprites(dirX: number, dirY: number, plX: number, plY: number) {
      const list: Sprite[] = [];
      for (const b of bots) list.push({ x: b.x, y: b.y, img: botImg(b), h: 0.62 });
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++) {
          const t = grid[r]![c];
          if (t !== "." && t !== "o") continue;
          const dx = c + 0.5 - P.x;
          const dy = r + 0.5 - P.y;
          if (dx * dx + dy * dy > 81) continue;
          list.push({ x: P.x + dx, y: P.y + dy, img: t === "." ? dotImg : cheeseImg, h: t === "." ? 0.13 : 0.3 });
        }
      const inv = 1 / (plX * dirY - dirX * plY);
      for (const s of list) {
        const rx = s.x - P.x;
        const ry = s.y - P.y;
        s.tx = inv * (dirY * rx - dirX * ry);
        s.ty = inv * (-plY * rx + plX * ry);
      }
      list.sort((a, b) => b.ty! - a.ty!);
      for (const s of list) {
        if (s.ty! <= 0.12) continue;
        const sx = (W / 2) * (1 + s.tx! / s.ty!);
        const wallH = H / s.ty!;
        const floorY = H / 2 + wallH / 2;
        const ph = s.h * wallH;
        const pw = ph * (s.img.width / s.img.height);
        const x0 = sx - pw / 2;
        if (x0 > W || x0 + pw < 0) continue;
        ctx.globalAlpha = Math.max(0.12, Math.min(1, 1.35 - s.ty! / 8));
        const srcStep = (s.img.width * COLW) / pw;
        for (let x = Math.max(0, Math.floor(x0 / COLW) * COLW); x < Math.min(W, x0 + pw); x += COLW) {
          const col = (x / COLW) | 0;
          if (zbuf[col]! <= s.ty!) continue;
          ctx.drawImage(s.img, ((x - x0) / pw) * s.img.width, 0, Math.max(srcStep, 0.5), s.img.height, x, floorY - ph, COLW, ph);
        }
        ctx.globalAlpha = 1;
      }
    }
    function drawMini() {
      const mw = COLS * MS;
      const mh = ROWS * MS;
      const ox = W - mw - 10;
      const oy = 10;
      ctx.fillStyle = "rgba(3,8,16,.74)";
      ctx.fillRect(ox - 4, oy - 4, mw + 8, mh + 8);
      ctx.strokeStyle = "#5F2167";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(ox - 4, oy - 4, mw + 8, mh + 8);
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++) {
          const t = grid[r]![c];
          if (t === "#") {
            ctx.fillStyle = "#3a1f4a";
            ctx.fillRect(ox + c * MS, oy + r * MS, MS, MS);
          } else if (t === "-") {
            ctx.fillStyle = GOLD;
            ctx.fillRect(ox + c * MS, oy + r * MS + MS / 2 - 1, MS, 2);
          } else if (t === ".") {
            ctx.fillStyle = "rgba(255,215,110,.75)";
            ctx.fillRect(ox + c * MS + 2, oy + r * MS + 2, 1.4, 1.4);
          } else if (t === "o") {
            ctx.fillStyle = "#FFC93C";
            ctx.fillRect(ox + c * MS + 1, oy + r * MS + 1, 3, 3);
          }
        }
      for (const b of bots) {
        ctx.fillStyle = b.mode === "eyes" ? "#8fa2ff" : b.mode === "fright" ? "#2438b8" : b.color;
        ctx.beginPath();
        ctx.arc(ox + b.x * MS, oy + b.y * MS, 2.3, 0, 7);
        ctx.fill();
      }
      ctx.save();
      ctx.translate(ox + P.x * MS, oy + P.y * MS);
      ctx.rotate(P.a);
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(4.5, 0);
      ctx.lineTo(-3, -3);
      ctx.lineTo(-3, 3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    function frightBar() {
      const mw = COLS * MS;
      const ox = W - mw - 10;
      const oy = 10 + ROWS * MS + 10;
      ctx.fillStyle = "rgba(3,8,16,.74)";
      ctx.fillRect(ox - 4, oy - 2, mw + 8, 8);
      ctx.fillStyle = "#FFC93C";
      ctx.fillRect(ox - 2, oy, (mw + 4) * Math.max(0, frT / frMax), 4);
    }
    function fpBanner(txt: string, color: string) {
      ctx.save();
      ctx.font = "bold 30px 'Segoe UI',sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 18;
      ctx.fillText(txt, W / 2, H * 0.42);
      ctx.restore();
    }

    /* ---- loop ---- */
    let lastF = performance.now();
    let rafId = 0;
    function floop(now: number) {
      if (disposed) return;
      rafId = requestAnimationFrame(floop);
      const dt = Math.min((now - lastF) / 1000, 0.05);
      lastF = now;
      phaseT += dt;
      if (phase === "play") upd(dt);
      if (phase === "ready" && phaseT > 1.6) {
        phase = "play";
        phaseT = 0;
      }
      if (phase === "dying" && phaseT > 1.6) {
        if (lives <= 0) over();
        else {
          resetPos(false);
          phase = "ready";
          phaseT = 0;
        }
      }
      if (phase === "levelup" && phaseT > 2) {
        level++;
        resetGrid();
        resetPos(true);
        hud();
        phase = "ready";
        phaseT = 0;
      }
      render();
    }

    window.addEventListener("keydown", handleKeydown);
    window.addEventListener("keyup", handleKeyup);
    canvas.addEventListener("click", handleCanvasClick);
    document.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("touchstart", handleTouchStart, { passive: true });
    canvas.addEventListener("touchmove", handleTouchMove, { passive: true });

    function handleStart() {
      audioInit();
      overlay.classList.add("hidden");
      score = 0;
      lives = 3;
      level = 1;
      resetGrid();
      resetPos(true);
      hud();
      phase = "ready";
      phaseT = 0;
      sndStart();
    }
    function handleMute() {
      const m = toggleMute();
      muteBtn.textContent = m ? "🔇" : "🔊";
    }
    function pauseGame() {
      if (phase !== "play") return;
      phase = "paused";
      phaseT = 0;
      if (document.pointerLockElement === canvas) document.exitPointerLock();
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
      phase = "play";
      phaseT = 0;
    }
    function restartFromPause() {
      overlay.classList.add("hidden");
      pauseMenu.classList.add("hidden");
      startBtn.classList.remove("hidden");
      handleStart();
    }
    function exitToMenu() {
      pauseMenu.classList.add("hidden");
      startBtn.classList.remove("hidden");
      ovTitle.textContent = READY_TITLE;
      ovText.innerHTML = READY_HTML;
      startBtn.textContent = "Enter the Maze";
      overlay.classList.remove("hidden");
      phase = "idle";
      phaseT = 0;
    }
    function handlePauseToggle() {
      if (phase === "play") pauseGame();
      else if (phase === "paused") resumeGame();
    }
    function isFullscreen() {
      return document.fullscreenElement === wrap;
    }
    function handleFullscreenToggle() {
      if (isFullscreen()) {
        document.exitFullscreen();
      } else {
        wrap.requestFullscreen().catch(() => {});
      }
    }
    function handleFullscreenChange() {
      fullscreenBtn.textContent = isFullscreen() ? "⤢" : "⛶";
      // Leaving fullscreen mid-game is almost always the player hitting Esc,
      // which the browser consumes before the keydown handler can pause.
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

    function fit() {
      const fullscreen = isFullscreen();
      const availW = fullscreen ? window.innerWidth * 0.98 : Math.min(window.innerWidth * 0.94, 840);
      const availH = fullscreen
        ? window.innerHeight * 0.98
        : window.innerHeight - wrap.getBoundingClientRect().top - 60;
      const cap = fullscreen ? 3 : 1.4;
      const s = Math.min(availW / W, availH / H, cap);
      canvas.style.width = W * s + "px";
      canvas.style.height = H * s + "px";
    }
    window.addEventListener("resize", fit);
    fit();

    resetGrid();
    resetPos(true);
    hud();
    rafId = requestAnimationFrame(floop);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("keyup", handleKeyup);
      canvas.removeEventListener("click", handleCanvasClick);
      document.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("resize", fit);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      startBtn.removeEventListener("click", handleStart);
      muteBtn.removeEventListener("click", handleMute);
      pauseBtn.removeEventListener("click", handlePauseToggle);
      fullscreenBtn.removeEventListener("click", handleFullscreenToggle);
      resumeBtn.removeEventListener("click", resumeGame);
      restartBtn.removeEventListener("click", restartFromPause);
      exitBtn.removeEventListener("click", exitToMenu);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    };
  }, []);

  return (
    <div className="mx-auto flex flex-col items-center">
      <div className="flex w-full max-w-[840px] items-center justify-between px-1 py-2 font-mono text-sm">
        <div>
          SCORE <span ref={scoreRef} className="text-[#F2A900]">0</span>
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
        <canvas ref={canvasRef} width={W} height={H} role="application" aria-label="First-person maze view" className="rounded-lg border-2 border-ras-purple bg-[#140b1e] shadow-[0_0_30px_rgba(95,33,103,.45)]" />
        <button ref={muteBtnRef} type="button" title="Mute" className="absolute left-2 top-2 h-9 w-9 rounded-md border border-ras-purple/40 bg-black/40 text-lg">
          🔊
        </button>
        <button ref={fullscreenBtnRef} type="button" title="Fullscreen" className="absolute left-12 top-2 h-9 w-9 rounded-md border border-ras-purple/40 bg-black/40 text-lg">
          ⛶
        </button>
        <button ref={pauseBtnRef} type="button" title="Pause (Esc)" className="absolute left-24 top-2 h-9 w-9 rounded-md border border-ras-purple/40 bg-black/40 text-lg">
          ⏸
        </button>
        <div ref={overlayRef} className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-black/85 p-5 text-center">
          <div className="text-5xl">🐭</div>
          <h2 ref={ovTitleRef} className="font-display text-2xl font-bold uppercase tracking-widest text-[#F2A900]">
            Mouse-Eye View
          </h2>
          <p ref={ovTextRef} className="max-w-sm text-sm text-white/80">
            See the maze from the mouse&apos;s whiskers! Scurry the neon corridors, munch crumbs, and watch the{" "}
            <b>minimap</b>. Grab cheese to overclock and hunt the robots.
            <br />
            <br />
            W/S move &middot; A/D strafe &middot; Left/Right or mouse-look (click the view) &middot; minimap top-right
          </p>
          <button ref={startBtnRef} type="button" className="rounded-full border-2 border-[#F2A900] bg-ras-crimson px-8 py-3 text-sm font-bold uppercase tracking-widest text-white">
            Enter the Maze
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

      <p className="mt-2 text-center text-xs text-ras-gray dark:text-white/60">
        W/S move &middot; A/D strafe &middot; Left/Right or mouse-look (click view) &middot; minimap top-right
      </p>

      <div ref={liveRef} className="sr-only-live" aria-live="polite" />
    </div>
  );
}
