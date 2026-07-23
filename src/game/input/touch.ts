import type { Direction } from "@/game/engine/types";

const SWIPE_THRESHOLD_PX = 24;

export interface TouchController {
  getDirection: () => Direction;
  setDirection: (direction: Direction) => void;
  attach: (target: HTMLElement) => () => void;
}

export function createTouchController(): TouchController {
  let direction: Direction = "none";
  let startX = 0;
  let startY = 0;

  function handleTouchStart(e: TouchEvent) {
    const touch = e.touches[0];
    if (!touch) return;
    startX = touch.clientX;
    startY = touch.clientY;
  }

  function handleTouchEnd(e: TouchEvent) {
    const touch = e.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX && Math.abs(dy) < SWIPE_THRESHOLD_PX) return;

    direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
  }

  return {
    getDirection: () => direction,
    setDirection: (d) => {
      direction = d;
    },
    attach(target: HTMLElement) {
      target.addEventListener("touchstart", handleTouchStart, { passive: true });
      target.addEventListener("touchend", handleTouchEnd, { passive: true });
      return () => {
        target.removeEventListener("touchstart", handleTouchStart);
        target.removeEventListener("touchend", handleTouchEnd);
      };
    },
  };
}
