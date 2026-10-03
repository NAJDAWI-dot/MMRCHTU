/**
 * Sponsors: the rules for the Sponsors desk and the hall screen's slide.
 *
 * Free of Prisma and of Next so they can be tested on their own.
 */

import { EXTENSION_FOR_IMAGE_TYPE, slugify, type AllowedImageType } from "@/lib/gallery";

export const SPONSOR_NAME_MAX = 80;
export const SPONSOR_TIER_MAX = 40;

/**
 * A sponsor's website as a link it is safe to print: https:// is added when
 * it was typed without a scheme, and anything that is not a plain web address
 * comes back empty rather than as a "javascript:" link.
 */
export function cleanWebsite(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    if (!url.hostname.includes(".")) return "";
    return url.toString().slice(0, 300);
  } catch {
    return "";
  }
}

export type SponsorFields = { ok: true; name: string; tier: string; website: string } | { ok: false; message: string };

/** The desk form's text fields, checked. */
export function sponsorFields(form: { get(name: string): unknown }): SponsorFields {
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { ok: false, message: "Give the sponsor's name." };
  if (name.length > SPONSOR_NAME_MAX) return { ok: false, message: `Keep the name under ${SPONSOR_NAME_MAX} characters.` };
  const tier = String(form.get("tier") ?? "").trim().slice(0, SPONSOR_TIER_MAX);
  const typed = String(form.get("website") ?? "").trim();
  const website = cleanWebsite(typed);
  if (typed && !website) return { ok: false, message: "That website is not a web address. Leave it empty or use one like acme.com." };
  return { ok: true, name, tier, website };
}

/** Where a logo is stored: readable, so a saved file says whose logo it is. */
export function logoKey(name: string, imageType: AllowedImageType, unique: string): string {
  const slug = slugify(name) || "sponsor";
  return `sponsors/${slug}-${unique}.${EXTENSION_FOR_IMAGE_TYPE[imageType]}`;
}

/**
 * Sponsors grouped by tier, in the order the desk arranged them: each tier
 * appears where its first sponsor does, so the desk's order decides which tier
 * leads. Sponsors with no tier form one group with no heading.
 */
export function groupByTier<T extends { tier: string }>(sponsors: readonly T[]): { tier: string; sponsors: T[] }[] {
  const groups: { tier: string; sponsors: T[] }[] = [];
  for (const sponsor of sponsors) {
    const tier = sponsor.tier.trim();
    const group = groups.find((item) => item.tier.toLowerCase() === tier.toLowerCase());
    if (group) group.sponsors.push(sponsor);
    else groups.push({ tier, sponsors: [sponsor] });
  }
  return groups;
}

/** The tile behind a logo. */
export const LOGO_BACKGROUNDS = ["WHITE", "DARK"] as const;
export type LogoBackground = (typeof LOGO_BACKGROUNDS)[number];

export function parseLogoBackground(value: unknown): LogoBackground {
  return value === "DARK" ? "DARK" : "WHITE";
}

/** The dark tile's colour, the day site's darkest plum, in either theme. */
export const DARK_TILE = "#24102a";

/**
 * Which tile shows a logo best, from its pixels (RGBA, as a canvas gives them).
 *
 * A logo with no transparency brings its own background, so it stays on white.
 * Otherwise the logo's visible pixels are counted twice: how many would show
 * up on white, and how many on the dark tile. A white or pale logo, made for
 * dark backgrounds, all but vanishes on white and goes on the dark tile; a
 * logo that shows equally well on either stays on white.
 */
export function logoBackgroundFor(pixels: ArrayLike<number>): LogoBackground {
  let total = 0;
  let solid = 0;
  let onWhite = 0;
  let onDark = 0;
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    total++;
    if (pixels[i + 3]! < 128) continue;
    solid++;
    const light = (0.2126 * pixels[i]! + 0.7152 * pixels[i + 1]! + 0.0722 * pixels[i + 2]!) / 255;
    if (light < 0.85) onWhite++;
    if (light > 0.15) onDark++;
  }
  if (!solid || solid / total > 0.98) return "WHITE";
  return (onDark - onWhite) / solid > 0.1 ? "DARK" : "WHITE";
}
