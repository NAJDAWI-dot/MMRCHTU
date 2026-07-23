import type { Ghost, GhostName, Vec2 } from "@/game/engine/types";

/** Distinct marker per ghost so color-blind players can tell them apart. */
const GHOST_MARKERS: Record<GhostName, string> = {
  blinky: "solid",
  pinky: "stripe",
  inky: "dot",
  clyde: "ring",
};

export function drawMouse(ctx: CanvasRenderingContext2D, pos: Vec2, cell: number, mouthOpen: boolean) {
  const cx = pos.x * cell + cell / 2;
  const cy = pos.y * cell + cell / 2;
  const r = cell * 0.42;

  ctx.fillStyle = "#f4f2f5";
  ctx.beginPath();
  ctx.arc(cx - r * 0.6, cy - r * 0.9, r * 0.35, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.6, cy - r * 0.9, r * 0.35, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#5f2167";
  ctx.beginPath();
  const mouthAngle = mouthOpen ? 0.25 : 0.02;
  ctx.arc(cx, cy, r, mouthAngle * Math.PI, (2 - mouthAngle) * Math.PI);
  ctx.lineTo(cx, cy);
  ctx.fill();
}

export function drawGhost(ctx: CanvasRenderingContext2D, ghost: Ghost, cell: number, flashWhite: boolean) {
  const cx = ghost.position.x * cell + cell / 2;
  const cy = ghost.position.y * cell + cell / 2;
  const r = cell * 0.42;

  const bodyColor =
    ghost.mode === "eaten"
      ? "transparent"
      : ghost.mode === "frightened"
        ? flashWhite
          ? "#f4f2f5"
          : "#3a2e40"
        : resolveColor(ghost.color);

  if (ghost.mode !== "eaten") {
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.2, r, Math.PI, 0);
    ctx.lineTo(cx + r, cy + r * 0.8);
    for (let i = 3; i >= 0; i--) {
      const x = cx - r + (i / 3) * (2 * r);
      const y = i % 2 === 0 ? cy + r : cy + r * 0.5;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    drawMarker(ctx, ghost.name, cx, cy, r);
  }

  // eyes (always visible, even when eaten, to show it's "returning home")
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(cx - r * 0.35, cy - r * 0.2, r * 0.22, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.35, cy - r * 0.2, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1a1a1a";
  ctx.beginPath();
  ctx.arc(cx - r * 0.35, cy - r * 0.2, r * 0.1, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.35, cy - r * 0.2, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
}

function drawMarker(ctx: CanvasRenderingContext2D, name: GhostName, cx: number, cy: number, r: number) {
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  const marker = GHOST_MARKERS[name];
  if (marker === "stripe") {
    ctx.fillRect(cx - r * 0.5, cy + r * 0.1, r, r * 0.15);
  } else if (marker === "dot") {
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.15, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
  } else if (marker === "ring") {
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.15, r * 0.22, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.stroke();
  }
}

function resolveColor(cssVarColor: string): string {
  if (typeof document === "undefined") return "#862633";
  if (!cssVarColor.startsWith("var(")) return cssVarColor;
  const varName = cssVarColor.slice(4, -1).trim();
  const resolved = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return resolved || "#862633";
}
