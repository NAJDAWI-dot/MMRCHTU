/**
 * Turns the hand-drawn mouse SVGs into something a web page can actually use.
 *
 * The source files in mouse_SVG/ are auto-traced from drawings, and three
 * things about them make them unusable as they arrive:
 *
 *   - Each opens with a path filled #FEFEFE across the whole 1920x1080 canvas.
 *     Dropped on the celebration overlay that is a white rectangle covering the
 *     confirmation behind it, not a mouse.
 *   - The mouse occupies a fraction of that canvas, so rendered at a sensible
 *     size it would be a small figure marooned in empty space. The viewBox is
 *     retargeted to the drawing's own bounds.
 *   - Coordinates carry eight decimal places — "0.31916524" at a scale where
 *     the whole canvas is 1920 units wide and the thing is displayed around 300
 *     pixels across. Rounding to one decimal is invisible and is most of the
 *     file.
 *
 * Run with: node scripts/prepare-cheddar-svgs.mjs
 * Reads mouse_SVG/*.svg, writes public/brand/cheddar/cheddar-N.svg.
 *
 * Kept in the repo rather than run once and forgotten, so adding a sixth
 * drawing is a re-run rather than an archaeology exercise.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const SOURCE_DIR = "mouse_SVG";
const OUT_DIR = "public/brand/cheddar";

/** Breathing room around the drawing, as a fraction of its longest edge. */
const PADDING = 0.03;

/** Decimal places kept in path coordinates. */
const PRECISION = 1;

/**
 * A background path is matched on covering essentially the whole canvas rather
 * than on its colour: a white shape that is genuinely part of the mouse — an
 * eye glint — has to survive, and the only reliable difference between the two
 * is that the background is the size of the page. See COVERAGE below.
 */
const COVERAGE = 0.98;

function round(svg) {
  return svg
    // Eight decimals of precision on a 1920-unit canvas shown at 300px.
    .replace(/-?\d+\.\d+/g, (n) => {
      const value = Number.parseFloat(n).toFixed(PRECISION);
      // "12.0" -> "12", and "-0.0" -> "0".
      return String(Number.parseFloat(value));
    })
    // The tracer writes this on every path and it does nothing.
    .replace(/\s*transform="translate\(0,0\)"/g, "");
}

const browser = await chromium.launch();
const page = await browser.newPage();

mkdirSync(OUT_DIR, { recursive: true });

const files = readdirSync(SOURCE_DIR)
  .filter((f) => f.toLowerCase().endsWith(".svg"))
  .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));

let totalBefore = 0;
let totalAfter = 0;

for (const [index, file] of files.entries()) {
  const source = `${SOURCE_DIR}/${file}`;
  await page.goto(pathToFileURL(source).href, { waitUntil: "load" });

  // The browser does the geometry: it already parses these paths, and asking it
  // for a bounding box is exact where re-implementing a path parser would be
  // approximate and wrong on the first arc it met.
  const measured = await page.evaluate(
    ({ padding, coverage }) => {
      const svg = document.querySelector("svg");
      const canvas = { width: svg.width.baseVal.value, height: svg.height.baseVal.value };
      const paths = [...svg.querySelectorAll("path")];

      // Identified by rendered size, via getBoundingClientRect rather than
      // getBBox. getBBox reports a path's own coordinates *before* its
      // transform, and the tracer puts a transform on every path — so a bbox
      // union built from it describes a region the drawing is not in. The
      // first attempt at this cropped one file to empty space and another to
      // a corner of the mouse.
      const svgRect = svg.getBoundingClientRect();
      const backgroundIndexes = [];
      paths.forEach((path, i) => {
        const rect = path.getBoundingClientRect();
        if (rect.width >= svgRect.width * coverage && rect.height >= svgRect.height * coverage) {
          backgroundIndexes.push(i);
          path.remove();
        }
      });

      // With the background gone, the container's own bbox is the union of
      // what is left, in user space and with every child transform applied.
      const box = svg.getBBox();
      const pad = Math.max(box.width, box.height) * padding;

      return {
        canvas,
        backgroundIndexes,
        viewBox: [box.x - pad, box.y - pad, box.width + pad * 2, box.height + pad * 2].map((n) =>
          Number(n.toFixed(1)),
        ),
      };
    },
    { padding: PADDING, coverage: COVERAGE },
  );

  const raw = readFileSync(source, "utf8");

  // Split on the path elements so an index from the browser lines up with an
  // element here — the same document, parsed the same way, in order.
  const pathTags = raw.match(/<path\b[^>]*\/>/g) ?? [];
  const dropped = new Set(measured.backgroundIndexes);
  const kept = pathTags.filter((_, i) => !dropped.has(i));

  const [x, y, w, h] = measured.viewBox;
  const out = round(
    // No fill on the root: every traced path carries its own, and a default of
    // "none" here would silently blank any that did not.
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}">` +
      kept.join("") +
      `</svg>\n`,
  );

  const destination = `${OUT_DIR}/cheddar-${index + 1}.svg`;
  writeFileSync(destination, out, "utf8");

  const before = statSync(source).size;
  const after = statSync(destination).size;
  totalBefore += before;
  totalAfter += after;

  console.log(
    `${file} -> ${destination}  ${(before / 1024 / 1024).toFixed(2)}MB -> ${(after / 1024).toFixed(0)}KB` +
      `  (${Math.round((1 - after / before) * 100)}% smaller, ${pathTags.length - kept.length} background path(s) dropped,` +
      ` viewBox ${w}x${h})`,
  );
}

await browser.close();

console.log(
  `\ntotal ${(totalBefore / 1024 / 1024).toFixed(2)}MB -> ${(totalAfter / 1024).toFixed(0)}KB` +
    ` (${Math.round((1 - totalAfter / totalBefore) * 100)}% smaller)`,
);
