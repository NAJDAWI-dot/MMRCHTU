import type { Direction } from "@/game/engine/types";

const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
  W: "up",
  S: "down",
  A: "left",
  D: "right",
};

export interface KeyboardController {
  getDirection: () => Direction;
  consumePause: () => boolean;
  attach: (target: HTMLElement) => () => void;
}

export function createKeyboardController(): KeyboardController {
  let direction: Direction = "none";
  let pausePressed = false;

  function handleKeyDown(e: KeyboardEvent) {
    const mapped = KEY_DIRECTIONS[e.key];
    if (mapped) {
      direction = mapped;
      e.preventDefault();
      return;
    }
    if (e.key === " " || e.key === "Escape" || e.key === "p" || e.key === "P") {
      pausePressed = true;
      e.preventDefault();
    }
  }

  return {
    getDirection: () => direction,
    consumePause: () => {
      const value = pausePressed;
      pausePressed = false;
      return value;
    },
    attach(target: HTMLElement) {
      target.addEventListener("keydown", handleKeyDown);
      return () => target.removeEventListener("keydown", handleKeyDown);
    },
  };
}
