/**
 * The infection: the five days before competition day, during which the main
 * site slowly turns into the day site.
 *
 * Each day the countdown drops, the day site's maze spreads further across the
 * page behind everything, the brand colours move another step towards the day
 * palette, and the type and shapes follow. On the day itself the admins switch
 * the homepage over to the real day site; until they do, the main site wears
 * the day look whole. The day after, it is clean again.
 *
 * The stage is a number on <html data-infect>, 1 to 6, set before first paint
 * by the inline script below and kept current afterwards by InfectionLayer.
 * Everything that changes reads that attribute: the colours through the rules
 * infectionCss() writes, everything else through src/styles/infection.css.
 *
 * Free of React and of the clock, like countdown.ts: every function takes
 * `now`, so the boundaries can be tested without waiting for them.
 */

const DAY = 24 * 60 * 60 * 1000;

/** The last stage: the day look, whole. */
export const FULL_STAGE = 6;

/** Set on <html> while the site is infected. Absent means clean. */
export const INFECTION_ATTRIBUTE = "data-infect";

/** A stage picked with ?infection=N, held for the rest of the visit so it follows navigation. */
export const INFECTION_PREVIEW_KEY = "mmrc26-infection-preview";

/** The furthest stage this browser has already seen, so only the new spread is played. */
export const INFECTION_SEEN_KEY = "mmrc26-infection-seen";

/**
 * Which stage the site is at, `now`, for a competition starting at `eventDate`.
 *
 * Follows the number on the countdown exactly, which floors to whole days:
 * "5 days" is stage 1 and "1 day" is stage 5. Under a day to go, and through
 * the competition's first twenty-four hours, it is the whole day look. Six days
 * out or more, and from a day after the start, the site is clean.
 */
export function infectionStage(eventDate: Date | number | null | undefined, now: number, enabled = true): number {
  if (!enabled || eventDate === null || eventDate === undefined) return 0;
  const start = typeof eventDate === "number" ? eventDate : eventDate.getTime();
  if (!Number.isFinite(start)) return 0;
  const left = start - now;
  if (left <= -DAY) return 0;
  if (left <= 0) return FULL_STAGE;
  const days = Math.floor(left / DAY);
  if (days >= FULL_STAGE) return 0;
  return days === 0 ? FULL_STAGE : FULL_STAGE - days;
}

/**
 * When the stage next changes, in ms from `now`, or null if it never will.
 * The live page sets a timer on it, so a tab left open changes at the same
 * moment the counter drops a day.
 */
export function nextInfectionChange(eventDate: Date | number | null | undefined, now: number, enabled = true): number | null {
  if (!enabled || eventDate === null || eventDate === undefined) return null;
  const start = typeof eventDate === "number" ? eventDate : eventDate.getTime();
  if (!Number.isFinite(start)) return null;
  const left = start - now;
  if (left <= -DAY) return null;
  // The whole look holds from a day out until a day after the start.
  if (left < DAY) return left + DAY;
  // Far out, nothing happens until the countdown reaches five days.
  if (left >= FULL_STAGE * DAY) return left - FULL_STAGE * DAY + 1;
  // The counter floors, so its day ticks over just after each whole-day mark.
  return (left % DAY) + 1;
}

/**
 * Reads a preview asked for in the address: ?infection=3 shows stage 3,
 * ?infection=0 the clean site, ?infection=live goes back to the real date.
 * `undefined` when nothing was asked, so the caller keeps what it had.
 */
export function readPreview(value: string | null | undefined): number | "live" | undefined {
  if (value === null || value === undefined) return undefined;
  const raw = value.trim().toLowerCase();
  if (raw === "live" || raw === "off" || raw === "") return "live";
  const stage = Number(raw);
  if (!Number.isInteger(stage)) return undefined;
  return Math.min(FULL_STAGE, Math.max(0, stage));
}

/** Pages that are never infected: the admin area and the day site, which is the infection. */
export function infectionExempt(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return /^\/(admin|day)(\/|$)/.test(pathname);
}

/**
 * How far along the maze has spread, as a share of the longest flood-fill
 * distance. A small patch round the gold centre on the first day, the whole
 * board by the last.
 */
export const SPREAD = [0, 0.14, 0.36, 0.6, 0.82, 1, 1] as const;

/**
 * The inline script that sets the stage before first paint, from the start
 * time the page was rendered with. It repeats infectionStage and readPreview
 * in plain ES5 because it runs before any bundle; infection.test.ts runs it
 * against the TypeScript versions so the two cannot drift.
 */
export function infectionPrePaintScript(eventMs: number | null, enabled: boolean): string {
  return (
    `(function(){try{` +
    `var d=document.documentElement,p=location.pathname;` +
    `if(/^\\/(admin|day)(\\/|$)/.test(p))return;` +
    `var k=${JSON.stringify(INFECTION_PREVIEW_KEY)},q=new URLSearchParams(location.search).get("infection"),s=null;` +
    `if(q!==null){q=q.trim().toLowerCase();` +
    `if(q==="live"||q==="off"||q==="")sessionStorage.removeItem(k);` +
    `else if(/^-?\\d+$/.test(q))sessionStorage.setItem(k,String(Math.min(${FULL_STAGE},Math.max(0,+q))));}` +
    `var v=sessionStorage.getItem(k);if(v!==null)s=+v;` +
    `if(s===null){var t=${eventMs === null ? "null" : Math.round(eventMs)};s=0;` +
    `if(${enabled ? "true" : "false"}&&t!==null){var D=${DAY},l=t-Date.now();` +
    `if(l<=-D)s=0;else if(l<=0)s=${FULL_STAGE};else{var n=Math.floor(l/D);s=n>=${FULL_STAGE}?0:n===0?${FULL_STAGE}:${FULL_STAGE}-n;}}}` +
    `if(s>0)d.setAttribute(${JSON.stringify(INFECTION_ATTRIBUTE)},String(s));` +
    `}catch(e){}})();`
  );
}

// ---------------------------------------------------------------- colour

export type Rgb = readonly [number, number, number];

interface Swatch {
  /** The custom property, set in src/styles/tokens.css. */
  name: string;
  /** How the property is written: a bare triplet for Tailwind's alpha, or a colour. */
  form: "triplet" | "rgb" | "translucent";
  light: [Rgb, Rgb];
  dark: [Rgb, Rgb];
}

/**
 * Every colour the main site paints with, from what it is now to what the day
 * site uses in the same place. Light turns to the day site's chalk, dark to
 * its maze floor. The day-site values are the ones in src/styles/day.css.
 */
export const SWATCHES: readonly Swatch[] = [
  { name: "--rgb-white", form: "triplet", light: [[255, 255, 255], [255, 255, 255]], dark: [[255, 255, 255], [244, 238, 245]] },
  // Headings and dark fills: the brand purple becomes the day site's ink.
  { name: "--rgb-ras-purple", form: "triplet", light: [[95, 33, 103], [32, 13, 39]], dark: [[95, 33, 103], [74, 22, 84]] },
  { name: "--rgb-ras-crimson", form: "triplet", light: [[134, 38, 51], [163, 23, 58]], dark: [[134, 38, 51], [163, 23, 58]] },
  { name: "--rgb-ras-gray", form: "triplet", light: [[87, 86, 91], [86, 68, 92]], dark: [[87, 86, 91], [110, 95, 116]] },
  { name: "--rgb-mood-plum", form: "triplet", light: [[97, 17, 105], [106, 42, 120]], dark: [[97, 17, 105], [106, 42, 120]] },
  { name: "--rgb-mood-garnet", form: "triplet", light: [[151, 1, 45], [163, 23, 58]], dark: [[151, 1, 45], [163, 23, 58]] },
  { name: "--rgb-mood-rose", form: "triplet", light: [[161, 22, 64], [196, 18, 74]], dark: [[161, 22, 64], [196, 18, 74]] },
  { name: "--rgb-mood-orchid", form: "triplet", light: [[115, 46, 125], [106, 42, 120]], dark: [[115, 46, 125], [106, 42, 120]] },
  { name: "--rgb-mood-violet", form: "triplet", light: [[130, 70, 140], [106, 42, 120]], dark: [[130, 70, 140], [106, 42, 120]] },
  { name: "--rgb-mood-amethyst", form: "triplet", light: [[116, 52, 125], [106, 42, 120]], dark: [[116, 52, 125], [106, 42, 120]] },
  { name: "--color-accent-rgb", form: "triplet", light: [[134, 38, 51], [163, 23, 58]], dark: [[255, 184, 193], [255, 138, 162]] },
  { name: "--color-bg", form: "rgb", light: [[255, 255, 255], [244, 241, 245]], dark: [[23, 17, 26], [19, 10, 24]] },
  { name: "--color-surface", form: "rgb", light: [[247, 245, 248], [255, 255, 255]], dark: [[36, 28, 40], [29, 17, 36]] },
  { name: "--color-border", form: "rgb", light: [[227, 221, 229], [219, 214, 220]], dark: [[58, 46, 64], [52, 38, 58]] },
  { name: "--color-fg", form: "rgb", light: [[26, 26, 26], [32, 13, 39]], dark: [[244, 242, 245], [244, 238, 245]] },
  { name: "--color-bg-translucent", form: "translucent", light: [[255, 255, 255], [244, 241, 245]], dark: [[23, 17, 26], [19, 10, 24]] },
  { name: "--color-surface-translucent", form: "translucent", light: [[247, 245, 248], [255, 255, 255]], dark: [[36, 28, 40], [29, 17, 36]] },
];

/** How far each stage has moved the colours, from none to all of the way. */
export const COLOUR_MIX = [0, 0.2, 0.4, 0.6, 0.8, 1, 1] as const;

function toLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function fromLinear(value: number): number {
  const c = value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, c)) * 255);
}

function toOklab([r, g, b]: Rgb): [number, number, number] {
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromOklab([L, a, b]: [number, number, number]): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

/** A step of the way from one colour to another, mixed the way the eye sees it. */
export function mix(from: Rgb, to: Rgb, amount: number): Rgb {
  if (amount <= 0) return from;
  if (amount >= 1) return to;
  const a = toOklab(from);
  const b = toOklab(to);
  return fromOklab([a[0] + (b[0] - a[0]) * amount, a[1] + (b[1] - a[1]) * amount, a[2] + (b[2] - a[2]) * amount]);
}

/** WCAG contrast between two colours. */
export function contrast(a: Rgb, b: Rgb): number {
  const lum = ([r, g, bl]: Rgb) => 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(bl);
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** One swatch's colour at a stage, in a theme. */
export function swatchAt(name: string, theme: "light" | "dark", stage: number): Rgb {
  const swatch = SWATCHES.find((s) => s.name === name);
  if (!swatch) throw new Error(`No swatch ${name}`);
  const [from, to] = swatch[theme];
  return mix(from, to, COLOUR_MIX[stage] ?? 0);
}

function write(swatch: Swatch, [r, g, b]: Rgb): string {
  if (swatch.form === "triplet") return `${r} ${g} ${b}`;
  if (swatch.form === "rgb") return `rgb(${r} ${g} ${b})`;
  return `rgb(${r} ${g} ${b} / 0.72)`;
}

/**
 * The colour rules for every stage in both themes. Rendered once into the
 * page head: small, and computed here so the values the tests check are the
 * values the page uses. The rulebook's paper pages keep their own colours.
 */
export function infectionCss(): string {
  let css = "";
  for (let stage = 1; stage <= FULL_STAGE; stage++) {
    for (const theme of ["light", "dark"] as const) {
      const selector = theme === "light" ? `html[${INFECTION_ATTRIBUTE}="${stage}"]` : `html.dark[${INFECTION_ATTRIBUTE}="${stage}"]`;
      const body = SWATCHES.map((swatch) => `${swatch.name}:${write(swatch, swatchAt(swatch.name, theme, stage))}`).join(";");
      css += `${selector}{${body}}`;
    }
  }
  const paper = SWATCHES.map((swatch) => `${swatch.name}:${write(swatch, swatch.light[0])}`).join(";");
  css += `html[${INFECTION_ATTRIBUTE}] .book-light{${paper}}`;
  return css;
}
