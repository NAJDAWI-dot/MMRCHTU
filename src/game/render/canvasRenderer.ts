import type { GameState, TileType } from "@/game/engine/types";
import { drawGhost, drawMouse } from "@/game/render/sprites";

export const CELL_SIZE = 24;

function tileColor(tile: TileType, isDark: boolean): string | null {
  switch (tile) {
    case "wall":
      return isDark ? "#3a2e40" : "#5f2167";
    default:
      return null;
  }
}

export function createRenderer(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  return function render(state: GameState) {
    const isDark = document.documentElement.classList.contains("dark");
    const { maze } = state;
    canvas.width = maze.width * CELL_SIZE;
    canvas.height = maze.height * CELL_SIZE;

    ctx.fillStyle = isDark ? "#17111a" : "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let row = 0; row < maze.height; row++) {
      const rowTiles = maze.tiles[row];
      if (!rowTiles) continue;
      for (let col = 0; col < maze.width; col++) {
        const tile = rowTiles[col];
        const wallColor = tileColor(tile ?? "wall", isDark);
        if (wallColor) {
          ctx.fillStyle = wallColor;
          ctx.fillRect(col * CELL_SIZE + 1, row * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
        } else if (tile === "pellet") {
          drawDot(ctx, col, row, CELL_SIZE * 0.08, isDark ? "#f4f2f5" : "#862633");
        } else if (tile === "power-pellet") {
          drawDot(ctx, col, row, CELL_SIZE * 0.22, isDark ? "#f4f2f5" : "#862633");
        }
      }
    }

    const mouthOpen = Math.floor(state.elapsedMs / 150) % 2 === 0;
    const flashWhite = Math.floor(state.elapsedMs / 200) % 2 === 0;

    for (const ghost of state.ghosts) {
      drawGhost(ctx, ghost, CELL_SIZE, flashWhite);
    }
    drawMouse(ctx, state.mouse.position, CELL_SIZE, mouthOpen);
  };
}

function drawDot(ctx: CanvasRenderingContext2D, col: number, row: number, radius: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(col * CELL_SIZE + CELL_SIZE / 2, row * CELL_SIZE + CELL_SIZE / 2, radius, 0, Math.PI * 2);
  ctx.fill();
}
