/**
 * The running order of the /rules flip-book.
 *
 * The official PDF's pages are the book; the site's interactive diagrams are
 * bound in beside the rule each one illustrates. Pure data and arithmetic, so
 * the one property that makes the arrangement work — every diagram faces its
 * rule when the book lies open — is something a unit test can hold it to.
 *
 * The page images, text and links come from `public/rulebook/manifest.json`,
 * written by `scripts/build-rulebook.py` from the PDF.
 */

type Rect = [number, number, number, number];

export interface ManifestLink {
  /** In PDF points, from the page's top-left corner. */
  rect: Rect;
  /** Internal link: the printed PDF page it jumps to. */
  page?: number;
  /** Internal link: the contents entry's title. */
  label?: string;
  /** External link. */
  uri?: string;
}

export interface ManifestLine {
  text: string;
  rect: Rect;
  size: number;
}

export interface ManifestPage {
  number: number;
  width: number;
  height: number;
  src: string;
  srcSmall: string;
  lines: ManifestLine[];
  links: ManifestLink[];
}

export interface RulebookManifest {
  pdf: string;
  pages: ManifestPage[];
  /** A text-free page in the manual's livery, for the pages the book adds. */
  template: {
    src: string;
    srcSmall: string;
    width: number;
    height: number;
    /** Where the book's own pages lay out their content, in points. */
    body: Rect;
    /** The cheese badge's page number position, in points. */
    badge: Rect | null;
  };
  coverArt: string;
}

/** What the client needs: no text lines, which only the transcript uses. */
export type ClientManifest = Omit<RulebookManifest, "pages"> & {
  pages: Array<Omit<ManifestPage, "lines">>;
};

export type WidgetId = "maze" | "runs" | "footprint" | "checklist" | "score";

export type BookPage =
  | { kind: "pdf"; pdfPage: number }
  | {
      kind: "widget";
      widget: WidgetId;
      /** The PDF page this diagram belongs beside. */
      facing: number;
      /** The rulebook section it illustrates, as the PDF numbers it. */
      section: string;
      title: string;
    }
  | { kind: "inside-back" }
  | { kind: "back-cover" };

export const BOOK_PAGES: readonly BookPage[] = [
  { kind: "pdf", pdfPage: 1 },

  { kind: "pdf", pdfPage: 2 },
  { kind: "pdf", pdfPage: 3 },

  { kind: "pdf", pdfPage: 4 },
  { kind: "widget", widget: "maze", facing: 4, section: "2.2 The Maze", title: "Explore a maze" },

  { kind: "pdf", pdfPage: 5 },
  {
    kind: "widget",
    widget: "runs",
    facing: 5,
    section: "2.4 Strategy & Algorithms",
    title: "Search run vs speed run",
  },

  { kind: "pdf", pdfPage: 6 },
  {
    kind: "widget",
    widget: "footprint",
    facing: 6,
    section: "4. Rules for the Micromouse",
    title: "Check your robot's size",
  },

  { kind: "pdf", pdfPage: 7 },
  {
    kind: "widget",
    widget: "checklist",
    facing: 7,
    section: "6.1 General Contest Rules",
    title: "Ready for the day?",
  },

  { kind: "pdf", pdfPage: 8 },
  {
    kind: "widget",
    widget: "score",
    facing: 8,
    section: "6.3 Scoring, and Tie-Breakers",
    title: "Work out your score",
  },

  { kind: "pdf", pdfPage: 9 },
  { kind: "pdf", pdfPage: 10 },

  { kind: "pdf", pdfPage: 11 },
  { kind: "inside-back" },

  { kind: "back-cover" },
];

export const PAGE_COUNT = BOOK_PAGES.length;

/** The book index (zero-based) that shows a printed PDF page. */
export function pdfPageIndex(pdfPage: number): number {
  return BOOK_PAGES.findIndex((page) => page.kind === "pdf" && page.pdfPage === pdfPage);
}

/**
 * The pages visible together when the book lies open, as page-flip lays them
 * out with a cover: the front cover alone, then pairs, then the back cover
 * alone if the count leaves it over.
 */
export function spreadOf(index: number, count: number = PAGE_COUNT): number[] {
  if (index <= 0) return [0];
  const left = index % 2 === 1 ? index : index - 1;
  return left + 1 < count ? [left, left + 1] : [left];
}

/** Hard boards front and back; every other page is paper and bends. */
export function isHardPage(index: number, count: number = PAGE_COUNT): boolean {
  return index === 0 || index === count - 1;
}

/** The page's number as printed on its cheese badge. */
export function badgeLabel(page: BookPage): string | null {
  if (page.kind === "pdf") return String(page.pdfPage);
  if (page.kind === "widget") return `${page.facing}A`;
  return null;
}

/** A short spoken description, for the page counter and screen readers. */
export function describePage(page: BookPage): string {
  switch (page.kind) {
    case "pdf":
      return page.pdfPage === 1 ? "Front cover" : `Rulebook page ${page.pdfPage}`;
    case "widget":
      return `Interactive: ${page.title}`;
    case "inside-back":
      return "Downloads and links";
    case "back-cover":
      return "Back cover";
  }
}

/** Reads `?page=N` (one-based) into a book index, clamped to the book. */
export function pageFromQuery(value: string | null, count: number = PAGE_COUNT): number {
  const n = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(n, 1), count) - 1;
}

export function toClientManifest(manifest: RulebookManifest): ClientManifest {
  return {
    ...manifest,
    pages: manifest.pages.map(({ lines: _lines, ...page }) => page),
  };
}

/** The PDF's contents entries, for the jump menu. */
export function contentsEntries(manifest: ClientManifest): Array<{ label: string; index: number }> {
  return manifest.pages
    .flatMap((page) => page.links)
    .filter((link): link is ManifestLink & { page: number; label: string } =>
      Boolean(link.page && link.label),
    )
    .map((link) => ({ label: link.label, index: pdfPageIndex(link.page) }))
    .filter((entry) => entry.index >= 0);
}
