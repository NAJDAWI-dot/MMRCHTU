"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import type { Direction, GameState } from "@/game/engine/types";
import { createGameLoop, type GameLoop } from "@/game/engine/loop";
import { createInitialState, tick } from "@/game/engine/stateMachine";
import { createRng } from "@/game/engine/rng";
import { createRenderer, CELL_SIZE } from "@/game/render/canvasRenderer";
import { createKeyboardController } from "@/game/input/keyboard";
import { createTouchController } from "@/game/input/touch";
import { HUD, GameLiveRegion } from "@/game/ui/HUD";
import { GameOverlay } from "@/game/ui/GameOverlay";
import { Button } from "@/components/ui/Button";
import { MAZE_HEIGHT, MAZE_WIDTH } from "@/game/engine/maze";

const REDUCED_MOTION_KEY = "mmrc26-reduced-motion";
const HIGH_SCORE_KEY = "mmrc26-high-score";

const DPAD_DIRECTIONS: { direction: Direction; label: string; className: string }[] = [
  { direction: "up", label: "Up", className: "col-start-2 row-start-1" },
  { direction: "left", label: "Left", className: "col-start-1 row-start-2" },
  { direction: "right", label: "Right", className: "col-start-3 row-start-2" },
  { direction: "down", label: "Down", className: "col-start-2 row-start-3" },
];

export function CheddarMouseGame() {
  const [started, setStarted] = useState(false);
  const [renderState, setRenderState] = useState<GameState | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const loopRef = useRef<GameLoop | null>(null);
  const keyboardRef = useRef(createKeyboardController());
  const touchRef = useRef(createTouchController());
  const dpadDirectionRef = useRef<Direction>("none");

  useEffect(() => {
    const stored = window.localStorage.getItem(REDUCED_MOTION_KEY);
    setReducedMotion(stored === "true");
  }, []);

  const highScore = useCallback(() => {
    const stored = window.localStorage.getItem(HIGH_SCORE_KEY);
    return stored ? Number(stored) : 0;
  }, []);

  // Canvas only exists once `started` is true (it's in the post-Start JSX
  // branch below), so the loop is created here -- after that render -- not
  // inside the button's click handler, where canvasRef.current would still
  // be null.
  useEffect(() => {
    if (!started || !canvasRef.current) return;

    const initial = createInitialState(Date.now() % 2 ** 31, highScore());
    initial.reducedMotion = reducedMotion;
    const render = createRenderer(canvasRef.current);
    const rng = createRng(initial.rngSeed);

    const loop = createGameLoop(
      initial,
      tick,
      (state) => {
        render(state);
        setRenderState(state);
        if (state.score > highScore()) {
          window.localStorage.setItem(HIGH_SCORE_KEY, String(state.score));
        }
        // Harmless debug hook (phase/position/score only) used by the
        // Playwright game smoke test to assert wiring without reading canvas pixels.
        (window as unknown as { __CHEDDAR_MOUSE_DEBUG__?: unknown }).__CHEDDAR_MOUSE_DEBUG__ = {
          phase: state.phase,
          mousePosition: state.mouse.position,
          score: state.score,
        };
      },
      () => ({
        requestedDirection:
          dpadDirectionRef.current !== "none"
            ? consumeDpad(dpadDirectionRef)
            : touchRef.current.getDirection() !== "none"
              ? touchRef.current.getDirection()
              : keyboardRef.current.getDirection(),
        pause: keyboardRef.current.consumePause(),
      }),
      rng
    );

    loopRef.current = loop;
    loop.start();

    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally
    // runs once per `started` transition, not on every reducedMotion/highScore change
  }, [started]);

  const start = useCallback(() => setStarted(true), []);

  const restart = useCallback(() => {
    const loop = loopRef.current;
    if (!loop) return;
    const initial = createInitialState(Date.now() % 2 ** 31, highScore());
    initial.reducedMotion = reducedMotion;
    loop.resetState(initial);
  }, [highScore, reducedMotion]);

  const resume = useCallback(() => {
    const loop = loopRef.current;
    if (!loop) return;
    const state = loop.getState();
    if (state.phase === "paused") {
      loop.resetState({ ...state, phase: "playing" });
    }
  }, []);

  useEffect(() => {
    if (!started || !containerRef.current) return;
    const detach = keyboardRef.current.attach(containerRef.current);
    const detachTouch = touchRef.current.attach(containerRef.current);
    containerRef.current.focus();
    return () => {
      detach();
      detachTouch();
    };
  }, [started]);

  useEffect(() => {
    function handleBlur() {
      const loop = loopRef.current;
      if (!loop) return;
      const state = loop.getState();
      if (state.phase === "playing") {
        loop.resetState({ ...state, phase: "paused" });
      }
    }
    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
  }, []);

  function toggleReducedMotion() {
    setReducedMotion((prev) => {
      const next = !prev;
      window.localStorage.setItem(REDUCED_MOTION_KEY, String(next));
      return next;
    });
  }

  if (!started) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-lg border border-ras-gray/20 p-10 text-center">
        <h2 className="font-display text-2xl font-bold text-ras-purple dark:text-white">
          Cheddar Mouse
        </h2>
        <p className="text-sm text-ras-gray dark:text-white/70">
          Guide the mouse through the maze, eat every crumb, and dodge the cats — unless you&apos;ve
          just grabbed a power pellet.
        </p>
        <label className="flex items-center gap-2 text-sm text-ras-gray dark:text-white/70">
          <input type="checkbox" checked={reducedMotion} onChange={toggleReducedMotion} />
          Reduced motion (no flashing)
        </label>
        <Button onClick={start}>Start game</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-fit">
      {renderState ? <HUD state={renderState} /> : null}
      {renderState ? <GameLiveRegion state={renderState} /> : null}
      <div
        ref={containerRef}
        role="application"
        aria-label="Cheddar Mouse game"
        tabIndex={0}
        className="relative outline-none"
        style={{ width: MAZE_WIDTH * CELL_SIZE, height: MAZE_HEIGHT * CELL_SIZE }}
      >
        <canvas ref={canvasRef} className="block" />
        {renderState ? (
          <GameOverlay
            phase={renderState.phase}
            score={renderState.score}
            onStart={resume}
            onRestart={restart}
          />
        ) : null}
      </div>

      <div className="mt-4 grid w-fit grid-cols-3 grid-rows-3 gap-2 sm:hidden" aria-hidden={false}>
        {DPAD_DIRECTIONS.map(({ direction, label, className }) => (
          <button
            key={direction}
            type="button"
            aria-label={label}
            className={`h-12 w-12 rounded-md border border-ras-gray/30 bg-[var(--color-surface)] font-bold text-ras-purple dark:text-white ${className}`}
            onTouchStart={() => (dpadDirectionRef.current = direction)}
            onClick={() => (dpadDirectionRef.current = direction)}
          >
            {directionArrow(direction)}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-center gap-3">
        <label className="flex items-center gap-2 text-sm text-ras-gray dark:text-white/70">
          <input type="checkbox" checked={reducedMotion} onChange={toggleReducedMotion} />
          Reduced motion
        </label>
      </div>
    </div>
  );
}

function consumeDpad(ref: MutableRefObject<Direction>): Direction {
  const value = ref.current;
  ref.current = "none";
  return value;
}

function directionArrow(direction: Direction): string {
  switch (direction) {
    case "up":
      return "↑";
    case "down":
      return "↓";
    case "left":
      return "←";
    case "right":
      return "→";
    default:
      return "•";
  }
}
