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
import { audioInit, sndMunch, sndCheese, sndEatRobot, sndDeath, sndLevel, sndPing, sndStart, isMuted, toggleMute } from "./audio";
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
/**
 * The logical drawing space.
 *
 * Everything in this file — the projection, the HUD, the minimap, the banners
 * — is drawn in these coordinates, and the canvas is scaled to whatever the
 * display actually wants. Keeping one fixed coordinate system is what lets the
 * resolution change without a single other number in here moving.
 */
const W = 640;
const H = 400;

/**
 * How many real pixels to render per logical pixel, over and above the
 * display's own density.
 *
 * The view used to be a 640x400 backing store showing 320 columns — one ray
 * for every two pixels, then upscaled again by the browser on any HiDPI
 * screen, which is roughly a quarter of the horizontal detail the display can
 * show. Rendering above the display's density and letting the browser
 * downsample is what removes the last of the stair-stepping on wall edges;
 * this is a cheap supersample, not a resolution the player ever sees directly.
 */
const SUPERSAMPLE = 1.5;

/** Past this the cost is real and the difference is not visible. */
const MAX_RENDER_SCALE = 3;

/**
 * Never below this. One rendered pixel per logical pixel is what the view used
 * to do at its best, so this floor guarantees the adaptive scaling can only
 * ever land somewhere at least as good as the old fixed renderer.
 */
const MIN_RENDER_SCALE = 1;

/**
 * How long a frame may take before the view gives up some resolution.
 *
 * Resolution is chosen by measurement rather than by a number picked in
 * advance, because the right one is not a property of the game: the same scene
 * costs wildly different amounts on a machine compositing with a GPU and one
 * falling back to software. Measured, the full supersample held 60fps in one
 * and managed 15 in the other — so any fixed choice is either needlessly
 * blurry for most people or unplayable for some.
 *
 * The measurement is the interval between frames, not the time spent inside
 * the draw call. Canvas work is queued: the first attempt at this timed
 * render() and saw a handful of milliseconds while frames were actually
 * arriving 60ms apart, so it never once noticed it was drowning.
 *
 * 20ms is 50fps — the point where movement stops being smooth.
 */
const FRAME_BUDGET_MS = 20;

/**
 * At or near the display's own refresh, which is as fast as frames can arrive.
 *
 * Being here does not prove there is spare capacity, only that there is no
 * shortage — so quality is raised from it slowly, and a raise that turns out
 * to be too much is simply undone at the next check.
 */
const FRAME_COMFORTABLE_MS = 17.4;

/** Long enough that a single slow frame cannot start a wobble. */
const QUALITY_SETTLE_MS = 900;

/** Consecutive comfortable windows required before asking for more. */
const RAISE_AFTER_WINDOWS = 2;

/**
 * How much larger the sprite sheets are drawn than their nominal size.
 *
 * Robots are pre-rendered once and then scaled to whatever the distance calls
 * for. At the old size a robot right in front of the player was being scaled
 * up several times over and went soft exactly when it mattered most.
 */
const SPRITE_SCALE = 3;
const FOV = Math.PI / 3;
/**
 * How wide the view opens while a cheese is burning.
 *
 * The power-up had no visual language of its own — the robots turned blue and
 * that was all. Widening the field is the mouse's own point of view changing:
 * for a few seconds it can see more of the corridor than it normally can,
 * which is exactly what being the hunter rather than the hunted feels like.
 */
const FOV_FRIGHT = FOV * 1.22;
const THALF = Math.tan(FOV / 2);
const MS = 5; // minimap tile size

/**
 * The competition's own surfaces, from the rulebook: wall sides white, wall
 * tops red, floor black. The maze rendered here is the maze that gets built.
 */
const WALL_SIDE = { r: 220, g: 218, b: 224 };
const WALL_TOP = { r: 179, g: 37, b: 47 };

/** Beyond this many tiles a robot is only a pair of eyes in the dark. */
const EYES_ONLY_FROM = 4.6;

/** How close a robot has to be before the mouse starts hearing it. */
const PING_RANGE = 7;

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
  const stickRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);

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
      !stickRef.current ||
      !knobRef.current ||
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
    const stick = stickRef.current as HTMLDivElement;
    const knob = knobRef.current as HTMLDivElement;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

    let disposed = false;
    const READY_TITLE = ovTitle.textContent ?? "Mouse-Eye View";
    const READY_HTML = ovText.innerHTML;

    /* ---- world ---- */
    let grid: MazeGrid = buildMaze();
    let dotsLeft = countPellets(grid);
    /*
      What the mouse has actually seen.

      A real micromouse knows only the cells it has driven past and sensed, and
      the minimap used to hand the player the whole maze for free. This is
      filled in by the raycaster itself — every tile a ray passes through is a
      tile in view — so the map builds up exactly as far as the mouse can see,
      with no separate visibility pass to disagree with what is on screen.
    */
    let seen: boolean[][] = buildSeen();

    function buildSeen(): boolean[][] {
      return Array.from({ length: ROWS }, () => new Array<boolean>(COLS).fill(false));
    }
    function resetGrid() {
      grid = buildMaze();
      dotsLeft = countPellets(grid);
      // A new sector is a maze the mouse has never driven, so the map starts
      // blank again.
      seen = buildSeen();
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
    /** Eased rather than snapped, so the widening reads as the view opening. */
    let fov = FOV;
    /** Decaying 0..1, driving the camera kick and the red wash after a hit. */
    let hurt = 0;
    /** Seconds until the next proximity tick. */
    let pingT = 0;
    const P = { x: 9.5, y: 11.5, a: -Math.PI / 2 };
    let bots: Bot[] = [];
    /*
      Resolution state. `num` is one ray per rendered pixel column, so the wall
      edges land exactly where the display can put them; `colw` is that column
      measured back in logical units, which is what everything drawing into the
      scaled space needs.
    */
    let renderScale = 1;
    /**
     * A multiplier on the resolution the display asks for, moved by how long
     * drawing is actually taking. 1 is "give me everything".
     */
    let quality = 1;
    /** Rolling average of the interval between frames. */
    let frameMs = 16.7;
    let comfortableWindows = 0;
    let lastQualityChange = 0;
    let num = W;
    let colw = 1;
    let zbuf = new Float32Array(num);
    /*
      Per-column results from the cast, kept so the drawing can be done in a
      second pass that groups columns into whole wall faces.

      `face` identifies the exact tile and side a column hit, which is what
      makes the grouping possible: every column sharing one is looking at the
      same flat surface, and a flat surface projects to a straight-edged shape
      that can be drawn once instead of a thousand times.
    */
    let colDist = new Float32Array(num);
    let colTop = new Float32Array(num);
    let colHeight = new Float32Array(num);
    let colFace = new Int32Array(num);
    let colSide = new Uint8Array(num);
    let colDoor = new Uint8Array(num);

    /**
     * Matches the backing store to the element and the display.
     *
     * Called on mount and on resize. Changing `canvas.width` resets the whole
     * 2D context state, which is why the smoothing hints are re-applied here
     * rather than once at start-up — and why every frame sets its own
     * transform instead of relying on one set outside the loop.
     */
    function syncResolution() {
      const rect = canvas.getBoundingClientRect();
      const cssW = rect.width || W;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const ideal = (cssW / W) * dpr * SUPERSAMPLE;
      renderScale = Math.max(
        MIN_RENDER_SCALE,
        Math.min(MAX_RENDER_SCALE, ideal * quality),
      );

      const bw = Math.max(1, Math.round(W * renderScale));
      const bh = Math.max(1, Math.round(H * renderScale));
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      num = bw;
      colw = W / num;
      if (zbuf.length !== num) {
        zbuf = new Float32Array(num);
        colDist = new Float32Array(num);
        colTop = new Float32Array(num);
        colHeight = new Float32Array(num);
        colFace = new Int32Array(num);
        colSide = new Uint8Array(num);
        colDoor = new Uint8Array(num);
      }
    }

    // A first guess before layout; fit() calls this again with the real size
    // as soon as it has one, and after every change to it.
    syncResolution();

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
    /* ---- touch controls ----------------------------------------------------
      The old scheme was a single drag on the canvas that both turned and moved:
      it called tryMove once per touchmove event, so the mouse only travelled
      while a finger was physically sliding. Walking down a corridor meant
      swiping over and over, speed depended on how fast you swiped, and the one
      finger had to steer at the same time.

      Replaced with the pattern every mobile shooter uses: a thumbstick that
      holds a direction, and a separate drag to look. The stick writes into
      `touchAxis`, which movePlayer reads every frame — so holding it walks, and
      the speed is frame-rate independent like the keyboard already was.

      X is turn rather than strafe. This is a maze seen through corridors:
      turning is what you need constantly and strafing almost never, and a stick
      that strafes leaves a player who never discovers look-drag unable to round
      a corner at all.
    */
    const touchAxis = { fwd: 0, turn: 0 };
    // Below this the stick reads as centred, so a thumb resting on the pad does
    // not creep the mouse forward.
    const STICK_DEADZONE = 0.14;
    let stickPointer: number | null = null;
    let lookPointer: number | null = null;
    let lookPrevX = 0;

    function stickVector(e: PointerEvent) {
      const r = stick.getBoundingClientRect();
      const max = r.width / 2;
      let dx = e.clientX - (r.left + max);
      let dy = e.clientY - (r.top + r.height / 2);
      const dist = Math.hypot(dx, dy);
      if (dist > max) {
        dx = (dx / dist) * max;
        dy = (dy / dist) * max;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const nx = dx / max;
      const ny = -dy / max;
      touchAxis.turn = Math.abs(nx) < STICK_DEADZONE ? 0 : nx;
      touchAxis.fwd = Math.abs(ny) < STICK_DEADZONE ? 0 : ny;
    }
    function releaseStick() {
      stickPointer = null;
      touchAxis.fwd = 0;
      touchAxis.turn = 0;
      knob.style.transform = "";
    }
    function handleStickDown(e: PointerEvent) {
      if (stickPointer !== null) return;
      stickPointer = e.pointerId;
      // Capture so the axis keeps updating if the thumb slides off the pad,
      // and so releasing outside it still recentres rather than sticking on.
      stick.setPointerCapture(e.pointerId);
      audioInit();
      stickVector(e);
      e.preventDefault();
    }
    function handleStickMove(e: PointerEvent) {
      if (e.pointerId !== stickPointer) return;
      stickVector(e);
      e.preventDefault();
    }
    function handleStickUp(e: PointerEvent) {
      if (e.pointerId !== stickPointer) return;
      releaseStick();
    }

    function handleLookDown(e: PointerEvent) {
      // Mouse look is already handled by pointer lock on click; this is for
      // fingers and styluses only.
      if (e.pointerType === "mouse" || lookPointer !== null) return;
      lookPointer = e.pointerId;
      lookPrevX = e.clientX;
      canvas.setPointerCapture(e.pointerId);
      audioInit();
    }
    function handleLookMove(e: PointerEvent) {
      if (e.pointerId !== lookPointer) return;
      if (phase === "play") P.a += (e.clientX - lookPrevX) * 0.006;
      lookPrevX = e.clientX;
    }
    function handleLookUp(e: PointerEvent) {
      if (e.pointerId !== lookPointer) return;
      lookPointer = null;
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
      rot += touchAxis.turn;
      P.a += rot * 2.7 * dt;
      let f = 0;
      let s = 0;
      if (keys["w"] || keys["arrowup"]) f += 1;
      if (keys["s"] || keys["arrowdown"]) f -= 1;
      if (keys["a"]) s -= 1;
      if (keys["d"]) s += 1;
      f += touchAxis.fwd;
      if (f || s) {
        const dx = Math.cos(P.a) * f + Math.cos(P.a + Math.PI / 2) * s;
        const dy = Math.sin(P.a) * f + Math.sin(P.a + Math.PI / 2) * s;
        const len = Math.hypot(dx, dy) || 1;
        // Scaled by how far the stick is pushed, so a gentle nudge creeps and a
        // full push runs. Capped at 1 so this cannot outrun the keyboard, which
        // always supplies a whole unit and is unaffected by the change.
        const throttle = Math.min(1, Math.hypot(f, s));
        const sp =
          ((3.3 + (frT > 0 ? 0.4 : 0)) * GAME_SPEED_SCALE * MOUSE_SPEED_SCALE * dt * throttle) / len;
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
      // The view opens while a cheese burns and closes again after it.
      const fovWant = frT > 0 ? FOV_FRIGHT : FOV;
      fov += (fovWant - fov) * Math.min(1, dt * 4.5);
      if (hurt > 0) hurt = Math.max(0, hurt - dt / 0.9);
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

      /*
        Listening for what is behind you. Only robots actually hunting tick —
        one you have frightened is running away, and a warning about it would
        be telling the player the opposite of what is happening.
      */
      let nearest = Infinity;
      for (const b of bots) {
        if (b.mode !== "active") continue;
        nearest = Math.min(nearest, Math.hypot(b.y - P.y, b.x - P.x));
      }
      if (nearest < PING_RANGE) {
        const closeness = 1 - nearest / PING_RANGE;
        pingT -= dt;
        if (pingT <= 0) {
          sndPing(closeness);
          // From a lazy tick at the edge of hearing to a hard stutter when one
          // is on top of you.
          pingT = 0.78 - closeness * 0.66;
        }
      } else {
        pingT = 0;
      }

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
            hurt = 1;
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
      return mk(64 * SPRITE_SCALE, 84 * SPRITE_SCALE, (g) => {
        g.translate(32 * SPRITE_SCALE, 52 * SPRITE_SCALE);
        g.scale(2.6 * SPRITE_SCALE, 2.6 * SPRITE_SCALE);
        robotShape(g, eyesOnly ? null : flash ? "#dfeeff" : fr ? "#2438b8" : color, fr, flash);
      });
    }
    /**
     * A robot too far off to make out: two lit eyes and nothing else.
     *
     * Corridors are long and the far end of one is dark, so a robot used to
     * appear as a fully drawn machine at a distance no real eye could resolve.
     * Eyes first, body as it closes, is both truer and considerably more
     * frightening.
     */
    function glowSpr(color: string) {
      return mk(64 * SPRITE_SCALE, 84 * SPRITE_SCALE, (g) => {
        g.translate(32 * SPRITE_SCALE, 52 * SPRITE_SCALE);
        g.scale(2.6 * SPRITE_SCALE, 2.6 * SPRITE_SCALE);
        g.shadowColor = color;
        g.shadowBlur = 12;
        for (const side of [-3.5, 3.5]) {
          g.fillStyle = color;
          g.beginPath();
          g.ellipse(side, -4, 2.6, 3, 0, 0, 7);
          g.fill();
        }
        g.shadowBlur = 0;
        g.fillStyle = "#fff";
        for (const side of [-3.5, 3.5]) {
          g.beginPath();
          g.arc(side, -3.6, 1.1, 0, 7);
          g.fill();
        }
      });
    }
    const sprGlow: Record<string, HTMLCanvasElement> = {};
    for (const d of ROBOT_DEFS) sprGlow[d.name] = glowSpr(d.color);

    const sprBody: Record<string, HTMLCanvasElement> = {};
    const sprFright = robotSpr(null, true, false);
    const sprFlash = robotSpr(null, true, true);
    const sprEyes = robotSpr(null, false, false, true);
    for (const d of ROBOT_DEFS) sprBody[d.name] = robotSpr(d.color, false, false);
    const dotImg = mk(16 * SPRITE_SCALE, 16 * SPRITE_SCALE, (g) => {
      g.scale(SPRITE_SCALE, SPRITE_SCALE);
      const rg = g.createRadialGradient(8, 8, 1, 8, 8, 8);
      rg.addColorStop(0, "#fff2c4");
      rg.addColorStop(0.4, "#ffd76e");
      rg.addColorStop(1, "rgba(255,215,110,0)");
      g.fillStyle = rg;
      g.fillRect(0, 0, 16, 16);
    });
    const cheeseImg = mk(48 * SPRITE_SCALE, 48 * SPRITE_SCALE, (g) => {
      g.scale(SPRITE_SCALE, SPRITE_SCALE);
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
    function botImg(b: Bot, dist = 0) {
      if (b.mode === "eyes") return sprEyes;
      if (b.mode === "fright") return frT < 2 && Math.floor(frT * 6) % 2 === 0 ? sprFlash : sprFright;
      // Only an unfrightened robot hides in the dark; one you are hunting
      // should be findable.
      if (dist > EYES_ONLY_FROM) return sprGlow[b.name]!;
      return sprBody[b.name]!;
    }

    /* ---- rendering ---- */
    const ceilGrad = ctx.createLinearGradient(0, 0, 0, H / 2);
    ceilGrad.addColorStop(0, "#020609");
    ceilGrad.addColorStop(1, "#180b22");
    // Black, per the rulebook. Not flat black: a floor with no gradient at all
    // gives the eye nothing to judge distance by in a corridor.
    const floorGrad = ctx.createLinearGradient(0, H / 2, 0, H);
    floorGrad.addColorStop(0, "#0b0b0d");
    floorGrad.addColorStop(1, "#000000");

    function render() {
      /*
        Set every frame, not once: resizing the canvas resets the context, and
        the hit kick rides on the same transform rather than a save/restore
        pair around the whole render.
      */
      ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
      if (hurt > 0) {
        // Painted first, because the frame is about to be shifted and the edge
        // it leaves behind would otherwise smear the previous frame down the
        // side of the screen.
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, W, H);
        const k = hurt * hurt * 9;
        ctx.translate((Math.random() * 2 - 1) * k, (Math.random() * 2 - 1) * k);
      }
      ctx.fillStyle = ceilGrad;
      ctx.fillRect(0, 0, W, H / 2);
      ctx.fillStyle = floorGrad;
      ctx.fillRect(0, H / 2, W, H / 2);
      const dirX = Math.cos(P.a);
      const dirY = Math.sin(P.a);
      // Derived per frame rather than from the THALF constant: the field of
      // view is no longer fixed.
      const tHalf = Math.tan(fov / 2);
      const plX = -dirY * tHalf;
      const plY = dirX * tHalf;

      for (let i = 0; i < num; i++) {
        const camX = (2 * i) / num - 1;
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
          // Every tile a ray passes through is a tile the mouse can see, and
          // the wall it stops on is the wall it has just sensed.
          if (mapY >= 0 && mapY < ROWS && mapX >= 0 && mapX < COLS) seen[mapY]![mapX] = true;
          tile = cellAt(mapY, mapX);
          if (tile === "#" || tile === "-") break;
        }
        const dist = Math.max(0.05, side === 0 ? sideX - dX : sideY - dY);
        zbuf[i] = dist;
        /*
          Clamped far outside the frame rather than at just over one screen.

          The clamp used to bite at 2.2 screens, which is well within what a
          wall reaches when you stand against it — and a clamp that catches
          some columns of a face and not others bends the straight edge the
          face is drawn from below.
        */
        const hh = Math.min(H * 40, H / dist);
        colDist[i] = dist;
        colHeight[i] = hh;
        colTop[i] = H / 2 - hh / 2;
        colSide[i] = side;
        colDoor[i] = tile === "-" ? 1 : 0;
        // The exact surface this column landed on. Columns sharing it are
        // looking at one flat face and are drawn as one shape.
        colFace[i] = (mapY * COLS + mapX) * 2 + side;
      }

      drawWalls();
      drawSprites(dirX, dirY, plX, plY);
      drawRear();
      drawMini();
      drawSensors();
      if (frT > 0) frightBar();
      if (hurt > 0) drawHurt();
      if (phase === "ready") fpBanner("GET READY!", GOLD);
      if (phase === "levelup") fpBanner("SECTOR CLEARED!", "#4dff88");
      if (phase === "dying") fpBanner("SQUEAK...!", "#ffb3c1");
    }
    function shadeAt(dist: number, side: number) {
      return Math.max(0.1, 1 - dist / 11) * (side ? 0.72 : 1);
    }

    function faceColour(door: boolean, br: number) {
      return door
        ? `rgb(${(242 * br) | 0},${(169 * br) | 0},${(10 * br) | 0})`
        : `rgb(${(WALL_SIDE.r * br) | 0},${(WALL_SIDE.g * br) | 0},${(WALL_SIDE.b * br) | 0})`;
    }

    /**
     * Draws the walls one flat face at a time rather than one column at a time.
     *
     * The per-column version issued three fills for every column on screen.
     * That was tolerable at 320 columns and catastrophic at two thousand:
     * measured against the previous build, the same scene went from 60fps to
     * 12 purely on the cost of the calls, not the arithmetic.
     *
     * A flat wall projects to a straight-edged quad, so every run of columns
     * that hit the same tile and side is one shape — a few dozen fills a frame
     * instead of thousands. The shading across a run is a horizontal gradient
     * between its two ends, which is an approximation of the true 1/distance
     * falloff and indistinguishable from it across a single face.
     *
     * The seams that make a white corridor readable now fall exactly on the
     * joins between faces, which is where the real panels meet — closer to the
     * truth than the old test on the hit position within a tile.
     */
    function drawWalls() {
      let start = 0;
      while (start < num) {
        let end = start;
        const face = colFace[start]!;
        while (end + 1 < num && colFace[end + 1] === face) end++;

        const xa = start * colw;
        // Half a column of overlap: neighbouring faces drawn exactly edge to
        // edge leave a hairline of background between them once downsampled.
        const xb = (end + 1) * colw + 0.5;
        const ya = colTop[start]!;
        const yb = colTop[end]!;
        const ha = colHeight[start]!;
        const hb = colHeight[end]!;
        const bra = shadeAt(colDist[start]!, colSide[start]!);
        const brb = shadeAt(colDist[end]!, colSide[end]!);
        const door = colDoor[start] === 1;

        const body = ctx.createLinearGradient(xa, 0, xb, 0);
        body.addColorStop(0, faceColour(door, bra));
        body.addColorStop(1, faceColour(door, brb));
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.moveTo(xa, ya);
        ctx.lineTo(xb, yb);
        ctx.lineTo(xb, yb + hb);
        ctx.lineTo(xa, ya + ha);
        ctx.closePath();
        ctx.fill();

        // The red top edge, following the same slope as the face.
        const cap = ctx.createLinearGradient(xa, 0, xb, 0);
        cap.addColorStop(0, `rgb(${(WALL_TOP.r * bra) | 0},${(WALL_TOP.g * bra) | 0},${(WALL_TOP.b * bra) | 0})`);
        cap.addColorStop(1, `rgb(${(WALL_TOP.r * brb) | 0},${(WALL_TOP.g * brb) | 0},${(WALL_TOP.b * brb) | 0})`);
        ctx.fillStyle = cap;
        ctx.beginPath();
        ctx.moveTo(xa, ya);
        ctx.lineTo(xb, yb);
        ctx.lineTo(xb, yb + 3);
        ctx.lineTo(xa, ya + 3);
        ctx.closePath();
        ctx.fill();

        // Where the wall meets the black floor.
        ctx.fillStyle = `rgba(0,0,0,${(0.5 * ((bra + brb) / 2)).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(xa, ya + ha - 2);
        ctx.lineTo(xb, yb + hb - 2);
        ctx.lineTo(xb, yb + hb);
        ctx.lineTo(xa, ya + ha);
        ctx.closePath();
        ctx.fill();

        // The join with the previous face: a real panel seam, not a guess.
        if (start > 0) {
          ctx.fillStyle = `rgba(0,0,0,${(0.42 * bra).toFixed(3)})`;
          ctx.fillRect(xa, ya, Math.max(1, colw * 1.5), ha);
        }

        start = end + 1;
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
      for (const b of bots) {
        list.push({
          x: b.x,
          y: b.y,
          img: botImg(b, Math.hypot(b.x - P.x, b.y - P.y)),
          h: 0.62,
        });
      }
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

        /*
          Drawn in unbroken runs rather than one slice per column.

          The old loop issued a drawImage for every single column the sprite
          covered, which was tolerable at 320 columns and is not at several
          thousand — and each slice was independently filtered, so the seams
          between them showed as vertical banding across the robot. This walks
          the columns to find spans the wall does not hide, and draws each span
          once.
        */
        const firstCol = Math.max(0, Math.floor(x0 / colw));
        const lastCol = Math.min(num - 1, Math.ceil((x0 + pw) / colw));
        let runStart = -1;
        for (let col = firstCol; col <= lastCol + 1; col++) {
          const visible = col <= lastCol && zbuf[col]! > s.ty!;
          if (visible && runStart < 0) runStart = col;
          if (!visible && runStart >= 0) {
            const px0 = runStart * colw;
            const px1 = col * colw;
            const sx0 = ((px0 - x0) / pw) * s.img.width;
            const sx1 = ((px1 - x0) / pw) * s.img.width;
            if (sx1 > sx0) {
              ctx.drawImage(
                s.img,
                sx0,
                0,
                sx1 - sx0,
                s.img.height,
                px0,
                floorY - ph,
                px1 - px0,
                ph,
              );
            }
            runStart = -1;
          }
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
          // Nothing is drawn for a cell the mouse has not been able to see.
          if (!seen[r]![c]) continue;
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
        /*
          A robot appears on the map only where the mouse can currently see it
          — or always, while a cheese is burning and the mouse is the one doing
          the hunting. The rest of the time you are meant to be listening for
          them, which is what the proximity tick is for.
        */
        const br = Math.floor(b.y);
        const bc = Math.floor(b.x);
        const visible =
          b.mode === "fright" || (br >= 0 && br < ROWS && bc >= 0 && bc < COLS && seen[br]![bc]);
        if (!visible) continue;
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
    /**
     * The wall the mouse's own sensors would be reading, left, front and right.
     *
     * A micromouse navigates on three numbers, and this is those three numbers.
     * Read straight off the same grid the walls are drawn from rather than off
     * the rendered image, so it stays honest at any resolution.
     */
    function castRange(angle: number, limit = 8): number {
      const cx = Math.cos(angle);
      const cy = Math.sin(angle);
      // Stepped rather than a DDA: this is three rays a frame against a 19x21
      // grid, and the exactness a DDA buys is not worth the code beside it.
      for (let d = 0.08; d < limit; d += 0.06) {
        if (solid(Math.floor(P.y + cy * d), Math.floor(P.x + cx * d), false)) return d;
      }
      return limit;
    }

    function drawSensors() {
      const readings: Array<[string, number]> = [
        ["L", castRange(P.a - Math.PI / 2)],
        ["F", castRange(P.a)],
        ["R", castRange(P.a + Math.PI / 2)],
      ];
      const pw = 74;
      const ph = 58;
      const ox = 10;
      // Bottom-left, clear of the mute, fullscreen and pause buttons that sit
      // over the top-left of the canvas.
      const oy = H - ph - 10;

      ctx.fillStyle = "rgba(3,8,16,.74)";
      ctx.fillRect(ox, oy, pw, ph);
      ctx.strokeStyle = "#5F2167";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(ox, oy, pw, ph);

      ctx.font = "9px ui-monospace,Menlo,Consolas,monospace";
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(255,255,255,.55)";
      ctx.fillText("SENSORS", ox + 7, oy + 12);

      readings.forEach(([label, dist], i) => {
        const y = oy + 22 + i * 12;
        ctx.fillStyle = "rgba(255,255,255,.7)";
        ctx.fillText(label, ox + 7, y + 4);
        const barX = ox + 18;
        const barW = pw - 26;
        ctx.fillStyle = "rgba(255,255,255,.12)";
        ctx.fillRect(barX, y - 3, barW, 5);
        // Full bar means a wall right against the mouse, which is the reading
        // worth noticing at a glance.
        const near = Math.max(0, Math.min(1, 1 - dist / 5));
        ctx.fillStyle = near > 0.72 ? "#ff6b6b" : GOLD;
        ctx.fillRect(barX, y - 3, barW * near, 5);
      });
      ctx.textAlign = "start";
    }

    /**
     * The kick and the red wash after being caught.
     *
     * A vignette rather than the flat red rectangle this replaces: filling the
     * whole frame hid the maze at the one moment the player is trying to work
     * out what went wrong.
     */
    function drawHurt() {
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.18, W / 2, H / 2, H * 0.78);
      g.addColorStop(0, "rgba(228,0,43,0)");
      g.addColorStop(1, `rgba(228,0,43,${(0.72 * hurt).toFixed(3)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    /**
     * The strip across the top: what is behind the mouse.
     *
     * Casts its own short set of columns backwards and draws robots into them.
     * Deliberately does not mark anything as seen — the minimap is a record of
     * where the mouse has driven and looked, and a mirror is neither.
     *
     * Walls only, plus robots as lit blobs. Pellets are left out: at this size
     * they would be single dim pixels, and knowing where the food is behind you
     * is not what a mirror is for.
     */
    function drawRear() {
      const rw = 216;
      const rh = 46;
      const ox = (W - rw) / 2;
      const oy = 6;
      /*
        Held at a fixed, modest count on purpose. The mirror is 46 logical
        pixels tall and still draws per column, so scaling its rays with the
        main view bought detail nobody can see at that size and cost more fills
        per frame than the whole corridor.
      */
      const cols = 144;
      const cw = rw / cols;

      const a = P.a + Math.PI;
      const dirX = Math.cos(a);
      const dirY = Math.sin(a);
      const tHalf = Math.tan(fov / 2);
      const plX = -dirY * tHalf;
      const plY = dirX * tHalf;

      ctx.save();
      ctx.beginPath();
      ctx.rect(ox, oy, rw, rh);
      ctx.clip();

      ctx.fillStyle = "#08070c";
      ctx.fillRect(ox, oy, rw, rh / 2);
      ctx.fillStyle = "#000";
      ctx.fillRect(ox, oy + rh / 2, rw, rh / 2);

      const rz: number[] = new Array(cols).fill(1e9);
      for (let i = 0; i < cols; i++) {
        const camX = (2 * i) / cols - 1;
        const rX = dirX + plX * camX;
        const rY = dirY + plY * camX;
        let mapX = Math.floor(P.x);
        let mapY = Math.floor(P.y);
        const dX = Math.abs(1 / (rX || 1e-9));
        const dY = Math.abs(1 / (rY || 1e-9));
        const stepX = rX < 0 ? -1 : 1;
        const stepY = rY < 0 ? -1 : 1;
        let sideX = rX < 0 ? (P.x - mapX) * dX : (mapX + 1 - P.x) * dX;
        let sideY = rY < 0 ? (P.y - mapY) * dY : (mapY + 1 - P.y) * dY;
        let side = 0;
        let tile = "#";
        let n = 0;
        while (n++ < 48) {
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
        rz[i] = dist;
        // Dimmer than the forward view, so the eye reads it as a mirror rather
        // than as a second window.
        const br = Math.max(0.08, 1 - dist / 11) * (side ? 0.72 : 1) * 0.62;
        const hh = Math.min(rh * 2.4, rh / dist);
        const y0 = oy + rh / 2 - hh / 2;
        ctx.fillStyle =
          tile === "-"
            ? `rgb(${(242 * br) | 0},${(169 * br) | 0},${(10 * br) | 0})`
            : `rgb(${(WALL_SIDE.r * br) | 0},${(WALL_SIDE.g * br) | 0},${(WALL_SIDE.b * br) | 0})`;
        ctx.fillRect(ox + i * cw, y0, cw + 0.5, hh);
        ctx.fillStyle = `rgb(${(WALL_TOP.r * br) | 0},${(WALL_TOP.g * br) | 0},${(WALL_TOP.b * br) | 0})`;
        ctx.fillRect(ox + i * cw, y0, cw + 0.5, 2);
      }

      const inv = 1 / (plX * dirY - dirX * plY);
      for (const b of bots) {
        if (b.mode === "eyes") continue;
        const rx = b.x - P.x;
        const ry = b.y - P.y;
        const tx = inv * (dirY * rx - dirX * ry);
        const ty = inv * (-plY * rx + plX * ry);
        if (ty <= 0.2 || ty > 11) continue;
        const sx = ox + (rw / 2) * (1 + tx / ty);
        const col = Math.floor(((sx - ox) / rw) * cols);
        if (col < 0 || col >= cols || rz[col]! <= ty) continue;
        const rad = Math.max(1.6, Math.min(8, 5 / ty));
        ctx.globalAlpha = Math.max(0.25, Math.min(1, 1.3 - ty / 9));
        ctx.fillStyle = b.mode === "fright" ? "#2438b8" : b.color;
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(sx, oy + rh / 2, rad, 0, 7);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }

      ctx.restore();

      ctx.strokeStyle = "rgba(95,33,103,.9)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(ox, oy, rw, rh);
      ctx.font = "8px ui-monospace,Menlo,Consolas,monospace";
      ctx.fillStyle = "rgba(255,255,255,.45)";
      ctx.textAlign = "center";
      ctx.fillText("REAR", ox + rw / 2, oy + rh - 3);
      ctx.textAlign = "start";
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
      // The raw interval, before the clamp the simulation needs: a frame that
      // took 60ms has to be seen as 60ms by the thing deciding the resolution,
      // even though the physics must not be stepped that far at once.
      const rawFrameMs = now - lastF;
      const dt = Math.min(rawFrameMs / 1000, 0.05);
      lastF = now;
      // Ignores the first frame and anything after a tab has been in the
      // background, either of which would otherwise read as a stall.
      if (rawFrameMs > 0 && rawFrameMs < 500) {
        frameMs = frameMs * 0.88 + rawFrameMs * 0.12;
      }
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

      // The kick now rides on the frame's own transform, inside render().
      render();

      /*
        Trim or restore resolution to fit the frame budget.

        Only while playing: the menu and the pause screen draw a different and
        much cheaper frame, and letting those readings raise the quality would
        mean every round began by dropping it again.
      */
      if (phase === "play" && now - lastQualityChange > QUALITY_SETTLE_MS) {
        if (frameMs > FRAME_BUDGET_MS && quality > 0.34) {
          quality = Math.max(0.34, quality * 0.78);
          comfortableWindows = 0;
          syncResolution();
          lastQualityChange = now;
        } else if (frameMs < FRAME_COMFORTABLE_MS) {
          comfortableWindows++;
          if (comfortableWindows >= RAISE_AFTER_WINDOWS && quality < 1) {
            quality = Math.min(1, quality * 1.15);
            comfortableWindows = 0;
            syncResolution();
          }
          lastQualityChange = now;
        } else {
          comfortableWindows = 0;
          lastQualityChange = now;
        }
      }
    }

    window.addEventListener("keydown", handleKeydown);
    window.addEventListener("keyup", handleKeyup);
    canvas.addEventListener("click", handleCanvasClick);
    document.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("pointerdown", handleLookDown);
    canvas.addEventListener("pointermove", handleLookMove);
    canvas.addEventListener("pointerup", handleLookUp);
    canvas.addEventListener("pointercancel", handleLookUp);
    stick.addEventListener("pointerdown", handleStickDown);
    stick.addEventListener("pointermove", handleStickMove);
    stick.addEventListener("pointerup", handleStickUp);
    stick.addEventListener("pointercancel", handleStickUp);

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
      /*
        Measured against the container, not the window.

        Sizing to `window.innerWidth * 0.94` ignored the page's own padding and
        max width, so on a narrow phone the board came out wider than the column
        holding it: the view hung off the left edge, the page scrolled sideways,
        and the joystick anchored to the board's bottom-left went with it — half
        of it off-screen, which is no way to steer.
      */
      const container = wrap.parentElement;
      const containerW = container ? container.clientWidth : window.innerWidth;
      const availW = fullscreen ? window.innerWidth * 0.98 : Math.min(containerW, 840);
      const availH = fullscreen
        ? window.innerHeight * 0.98
        : window.innerHeight - wrap.getBoundingClientRect().top - 60;
      const cap = fullscreen ? 3 : 1.4;
      /*
        Height is a hard limit only where the page cannot scroll.

        Keeping the board inside the fold is right on a desktop. On a phone the
        title, blurb, mode tabs and score bar eat most of a 568px screen, and
        obeying the leftover height shrank the view to 182px across — technically
        on screen, and far too small to play. Vertical scrolling costs a thumb
        flick; an unreadable view costs the game.
      */
      const narrow = !fullscreen && containerW < 640;
      const s = narrow
        ? Math.min(availW / W, cap)
        : Math.min(availW / W, availH / H, cap);
      canvas.style.width = W * s + "px";
      canvas.style.height = H * s + "px";
      /*
        The backing store follows the CSS size, always.

        These were independent before: fit() scaled the element up to 1.4x
        normally and 3x in fullscreen while the buffer stayed 640x400, so the
        larger the view got the softer it became — worst exactly where someone
        had asked for it to be bigger.
      */
      syncResolution();
    }
    window.addEventListener("resize", fit);
    /*
      A resize event is not the only thing that changes the space available.
      This board mounts when the game tab is switched, mid layout- and
      animation-settle, so the first fit() can measure a width that is about to
      change and nothing would correct it. Watching the container catches that,
      along with orientation changes and late font loads.
    */
    const fitObserver = new ResizeObserver(fit);
    if (wrap.parentElement) fitObserver.observe(wrap.parentElement);
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
      canvas.removeEventListener("pointerdown", handleLookDown);
      canvas.removeEventListener("pointermove", handleLookMove);
      canvas.removeEventListener("pointerup", handleLookUp);
      canvas.removeEventListener("pointercancel", handleLookUp);
      stick.removeEventListener("pointerdown", handleStickDown);
      stick.removeEventListener("pointermove", handleStickMove);
      stick.removeEventListener("pointerup", handleStickUp);
      stick.removeEventListener("pointercancel", handleStickUp);
      window.removeEventListener("resize", fit);
      fitObserver.disconnect();
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
        {/* touch-none: without it, dragging to look scrolls the page instead
            and the view barely turns. The overlay above is not touch-none, so
            the page still scrolls normally while the menu is up. */}
        <canvas ref={canvasRef} width={W} height={H} role="application" aria-label="First-person maze view" className="touch-none rounded-lg border-2 border-ras-purple bg-[#140b1e] shadow-[0_0_30px_rgba(95,33,103,.45)]" />
        <button ref={muteBtnRef} type="button" title="Mute" className="absolute left-2 top-2 h-9 w-9 rounded-md border border-ras-purple/40 bg-black/40 text-lg">
          🔊
        </button>
        <button ref={fullscreenBtnRef} type="button" title="Fullscreen" className="absolute left-12 top-2 h-9 w-9 rounded-md border border-ras-purple/40 bg-black/40 text-lg">
          ⛶
        </button>
        <button ref={pauseBtnRef} type="button" title="Pause (Esc)" className="absolute left-24 top-2 h-9 w-9 rounded-md border border-ras-purple/40 bg-black/40 text-lg">
          ⏸
        </button>
        {/*
          Touch controls. Declared before the overlay so that, sharing a
          stacking context, the overlay paints on top and swallows the taps —
          the stick is inert on the menu and the pause screen without needing
          to be toggled.

          Only on devices that cannot hover: on a laptop it would sit over the
          view for no reason, and the keyboard is better there anyway.
        */}
        <div
          ref={stickRef}
          aria-hidden="true"
          // Sized against the view it sits on: the board is about 180px tall on
          // a small phone, so a larger pad would hide most of the corridor the
          // player is trying to walk down. Kept translucent for the same reason.
          className="absolute bottom-2 left-2 hidden h-24 w-24 touch-none select-none place-items-center rounded-full border-2 border-[#F2A900]/40 bg-black/30 backdrop-blur-sm [@media(hover:none)]:grid"
        >
          <div
            ref={knobRef}
            className="pointer-events-none h-10 w-10 rounded-full border-2 border-[#F2A900] bg-ras-crimson/70 shadow-[0_0_10px_rgba(242,169,0,.45)]"
          />
        </div>
        <p
          aria-hidden="true"
          className="pointer-events-none absolute bottom-4 right-3 hidden max-w-[9rem] text-right text-[10px] leading-tight text-white/60 [@media(hover:none)]:block"
        >
          Stick to walk and turn · drag the view to look
        </p>

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
            {/* Captured into READY_HTML on mount and restored when returning to
                the menu, so both variants have to live inside this element. */}
            <span className="[@media(hover:none)]:hidden">
              W/S move &middot; A/D strafe &middot; Left/Right or mouse-look (click the view) &middot; minimap
              top-right
            </span>
            <span className="hidden [@media(hover:none)]:inline">
              Hold the stick to walk and turn &middot; drag the view to look around &middot; minimap top-right
            </span>
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
        <span className="[@media(hover:none)]:hidden">
          W/S move &middot; A/D strafe &middot; Left/Right or mouse-look (click view) &middot; minimap top-right
        </span>
        <span className="hidden [@media(hover:none)]:inline">
          Hold the stick to walk and turn &middot; drag the view to look around &middot; minimap top-right
        </span>
      </p>

      <div ref={liveRef} className="sr-only-live" aria-live="polite" />
    </div>
  );
}
