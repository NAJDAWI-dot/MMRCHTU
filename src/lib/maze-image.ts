import { CELL, DIRS, MAZE_GOLD, type Cell, type Maze } from "@/lib/maze";
import { HEADING_NAMES, type Corner, type StartPlace, wallSegments } from "@/lib/micromouse";
import { cellCentre, goalCells, pathData } from "@/lib/rules";

/**
 * The Maze Lab's maze as a standalone picture, for saving as a PNG.
 *
 * The lab draws with the site's classes, which mean nothing outside the page,
 * so the saved image is its own SVG with the colours written in: the brand
 * purple walls, the gold goal, the crimson route, on white for printing.
 */

const INK = {
  wall: "#5f2167",
  number: "#57565b",
  zero: "#862633",
  route: "#862633",
  start: "#57565b",
  startCell: "rgba(87, 86, 91, 0.14)",
  shut: "rgba(134, 38, 51, 0.1)",
  caption: "#57565b",
};

/** White space round the maze, and the strip under it for the caption, in viewBox units. */
const PAD = 12;
const CAPTION = 14;

export interface MazeImage {
  maze: Maze;
  /** Distance from the centre per cell, as floodFill gives it. */
  distances: number[][];
  start: StartPlace;
  corner: Corner;
  /** What is drawn over the maze, as the lab is showing it. */
  show: "numbers" | "route" | "hand";
  route?: Cell[];
  hand?: Cell[];
}

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** "Start top-right, facing down" */
export function startCaption(corner: Corner, heading: number): string {
  return `Start ${corner}, facing ${HEADING_NAMES[heading]}`;
}

/**
 * The arrow in the start cell, at its open side and pointing out of it, so
 * the cell's number in the middle stays readable.
 */
export function startArrow(start: StartPlace): string {
  const { x, y } = cellCentre(start.cell);
  const d = DIRS[start.heading]!;
  const tip = { x: x + d.dx * 9, y: y + d.dy * 9 };
  const side = { x: -d.dy, y: d.dx };
  const base = { x: x + d.dx * 5.5, y: y + d.dy * 5.5 };
  const a = { x: base.x + side.x * 2.8, y: base.y + side.y * 2.8 };
  const b = { x: base.x - side.x * 2.8, y: base.y - side.y * 2.8 };
  return `M${tip.x} ${tip.y} L${a.x} ${a.y} L${b.x} ${b.y} Z`;
}

/** The picture as SVG text, `scale` pixels to a viewBox unit. */
export function mazeImageSvg(image: MazeImage, scale = 10): { svg: string; width: number; height: number } {
  const { maze, distances, start } = image;
  const side = maze.size * CELL;
  const width = side + PAD * 2;
  const height = side + PAD * 2 + CAPTION;
  const parts: string[] = [];

  parts.push(`<rect x="${-PAD}" y="${-PAD}" width="${width}" height="${height}" fill="#ffffff"/>`);
  for (const cell of goalCells(maze)) {
    parts.push(`<rect x="${cell.x * CELL}" y="${cell.y * CELL}" width="${CELL}" height="${CELL}" fill="${MAZE_GOLD}" fill-opacity="0.2" stroke="${MAZE_GOLD}" stroke-width="1.5"/>`);
  }
  distances.forEach((row, y) =>
    row.forEach((value, x) => {
      if (!Number.isFinite(value)) parts.push(`<rect x="${x * CELL}" y="${y * CELL}" width="${CELL}" height="${CELL}" fill="${INK.shut}"/>`);
    }),
  );

  parts.push(`<rect x="${start.cell.x * CELL}" y="${start.cell.y * CELL}" width="${CELL}" height="${CELL}" fill="${INK.startCell}"/>`);

  if (image.show === "numbers") {
    distances.forEach((row, y) =>
      row.forEach((value, x) => {
        if (!Number.isFinite(value)) return;
        const zero = value === 0;
        parts.push(
          `<text x="${x * CELL + CELL / 2}" y="${y * CELL + CELL / 2 + 2.6}" text-anchor="middle" font-size="7" font-family="Arial, Helvetica, sans-serif"${zero ? ' font-weight="700"' : ""} fill="${zero ? INK.zero : INK.number}">${value}</text>`,
        );
      }),
    );
  } else if (image.show === "route" && image.route?.length) {
    parts.push(`<path d="${pathData(image.route)}" fill="none" stroke="${INK.route}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`);
  } else if (image.show === "hand" && image.hand?.length) {
    parts.push(`<path d="${pathData(image.hand)}" fill="none" stroke="${MAZE_GOLD}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`);
  }

  // Over the route, so the way out still shows where the route leaves.
  parts.push(`<path d="${startArrow(start)}" fill="${INK.start}"/>`);

  const walls = wallSegments(maze, CELL)
    .filter((segment) => segment.present)
    .map((segment) => `<line x1="${segment.x1}" y1="${segment.y1}" x2="${segment.x2}" y2="${segment.y2}"/>`);
  parts.push(`<g stroke="${INK.wall}" stroke-width="2" stroke-linecap="square">${walls.join("")}</g>`);

  const caption = `MMRC 26 · ${maze.size} × ${maze.size} maze · ${startCaption(image.corner, start.heading)}`;
  parts.push(
    `<text x="0" y="${side + PAD + 1}" font-size="6" font-family="Arial, Helvetica, sans-serif" fill="${INK.caption}">${escape(caption)}</text>`,
  );

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width * scale}" height="${height * scale}" viewBox="${-PAD} ${-PAD} ${width} ${height}">${parts.join("")}</svg>`;
  return { svg, width: width * scale, height: height * scale };
}

/** Saves the picture as a PNG, drawn in the browser. */
export async function downloadMazePng(image: MazeImage, filename: string): Promise<void> {
  const { svg, width, height } = mazeImageSvg(image);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const picture = new Image();
    picture.src = url;
    await picture.decode();
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser cannot draw the picture.");
    context.drawImage(picture, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("This browser cannot save the picture.");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
  } finally {
    URL.revokeObjectURL(url);
  }
}
