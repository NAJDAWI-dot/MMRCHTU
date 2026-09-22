import { externalUrl } from "@/lib/links";

/**
 * The reading list at the foot of the build guide.
 *
 * Three kinds, because they are three different promises to the reader: a
 * video is half an hour of your evening, a playlist is a weekend, and a site
 * is somewhere to come back to. Sorting them into one list of blue links would
 * hide exactly that difference.
 *
 * No React and no Prisma in here. The admin screen validates with it, the
 * public section renders with it, and the tests can ask what it makes of a
 * shortened YouTube link without a browser or a database.
 */

export const REFERENCE_KINDS = ["VIDEO", "PLAYLIST", "SITE"] as const;
export type ReferenceKind = (typeof REFERENCE_KINDS)[number];

/** What each kind is called on the page and in the admin form. */
export const KIND_LABELS: Record<ReferenceKind, string> = {
  VIDEO: "Video",
  PLAYLIST: "Playlist",
  SITE: "Website",
};

/** The heading each group gets on the public page. */
export const KIND_HEADINGS: Record<ReferenceKind, string> = {
  VIDEO: "Watch",
  PLAYLIST: "Whole playlists",
  SITE: "Read",
};

/** Long enough for a YouTube link with a timestamp and a playlist on it. */
export const REFERENCE_URL_MAX = 500;
export const REFERENCE_TITLE_MAX = 160;
export const REFERENCE_NOTE_MAX = 400;

export interface Reference {
  id: string;
  kind: ReferenceKind;
  title: string;
  url: string;
  /** The channel or the site it belongs to. Shown under the title. */
  author: string;
  /** Why it is worth the reader's time, in the committee's own words. */
  note: string;
  sortOrder: number;
  isPublished: boolean;
}

/**
 * A row from the database, made safe to render.
 *
 * `kind` is a plain string in the schema, the same tradeoff the rest of the
 * app makes, so anything that is not one of the three falls back to a website.
 * A link that fails the URL check comes back empty and the caller drops it:
 * a card with no destination is worse than no card.
 */
export function toReference(row: {
  id: string;
  kind: string;
  title: string;
  url: string;
  author: string;
  note: string;
  sortOrder: number;
  isPublished: boolean;
}): Reference | null {
  const url = externalUrl(row.url, REFERENCE_URL_MAX);
  if (!url) return null;

  return {
    id: row.id,
    kind: parseKind(row.kind),
    title: row.title.trim() || url,
    url,
    author: row.author.trim(),
    note: row.note.trim(),
    sortOrder: row.sortOrder,
    isPublished: row.isPublished,
  };
}

export function parseKind(value: string | null | undefined): ReferenceKind {
  const upper = String(value ?? "").toUpperCase();
  return (REFERENCE_KINDS as readonly string[]).includes(upper)
    ? (upper as ReferenceKind)
    : "SITE";
}

export function parseReferenceUrl(value: string | null | undefined): string {
  return externalUrl(value, REFERENCE_URL_MAX);
}

/**
 * The video id inside a YouTube link, whichever shape it arrived in.
 *
 * Four shapes reach a text box: the watch link off the address bar, the
 * youtu.be one off the share button, the /shorts/ one off a phone, and the
 * /embed/ one out of somebody's HTML. All four are the same video, and a
 * reader who pastes the share link should not get a card with no picture on
 * it.
 */
export function youTubeVideoId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
  const path = parsed.pathname.split("/").filter(Boolean);

  if (host === "youtu.be") return valid(path[0]);
  if (host !== "youtube.com" && host !== "m.youtube.com" && host !== "music.youtube.com") {
    return null;
  }
  if (path[0] === "shorts" || path[0] === "embed" || path[0] === "live") return valid(path[1]);
  if (path[0] === "watch") return valid(parsed.searchParams.get("v"));
  return null;
}

/** The playlist id, which rides along on watch links too. */
export function youTubePlaylistId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    if (!host.endsWith("youtube.com")) return null;
    const list = parsed.searchParams.get("list");
    return list && /^[\w-]{10,60}$/.test(list) ? list : null;
  } catch {
    return null;
  }
}

function valid(id: string | null | undefined): string | null {
  return id && /^[\w-]{6,20}$/.test(id) ? id : null;
}

/**
 * The picture for a card, or nothing.
 *
 * YouTube serves a still for every video at a fixed address, so a card can
 * carry the frame the reader would see on YouTube without embedding a player,
 * without a script from another origin and without a cookie. A playlist has no
 * picture of its own, so it borrows the first video's when the link carries
 * one and otherwise goes without.
 */
export function thumbnailFor(reference: Pick<Reference, "kind" | "url">): string | null {
  const id = youTubeVideoId(reference.url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

/** Whether a reference is a YouTube link at all, whatever it is labelled. */
export function isYouTube(url: string): boolean {
  return youTubeVideoId(url) !== null || youTubePlaylistId(url) !== null;
}

/**
 * The published references, in the order they are shown, grouped by kind.
 *
 * Groups come back in the order of REFERENCE_KINDS rather than in whatever
 * order the rows arrived, and an empty group is left out, so a page with only
 * websites on it does not print two empty headings.
 */
export function groupReferences(
  references: Reference[],
): { kind: ReferenceKind; items: Reference[] }[] {
  const published = references
    .filter((item) => item.isPublished)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));

  return REFERENCE_KINDS.map((kind) => ({
    kind,
    items: published.filter((item) => item.kind === kind),
  })).filter((group) => group.items.length > 0);
}
