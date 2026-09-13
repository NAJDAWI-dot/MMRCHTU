"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Orientation, PageFlip } from "page-flip";
import {
  BOOK_PAGES,
  PAGE_COUNT,
  type ClientManifest,
  badgeLabel,
  contentsEntries,
  describePage,
  isHardPage,
  pageFromQuery,
  pdfPageIndex,
  spreadOf,
} from "@/lib/rulebook-book";
import { BackCover, InsideBackCover, PdfPage, WidgetPage } from "@/components/rulebook/BookPages";

/**
 * The rulebook as a book you turn the pages of.
 *
 * page-flip does the paper: the curl, the shadows, the drag from a corner and
 * the swipe. It works on DOM nodes it owns — it moves pages between containers,
 * clones them mid-turn and deletes its root on destroy — none of which React
 * tolerates in a tree it renders. So the page elements are created here, handed
 * to page-flip, and React draws into them through portals. React never has to
 * reconcile the nodes page-flip rearranges; page-flip never touches a node
 * React is responsible for removing.
 */

// A4 in PDF points, which is what every page image and the template share.
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
/** Pages within this distance of the open spread load their images and widgets. */
const LOAD_RADIUS = 3;

export function FlipBook({ manifest }: { manifest: ClientManifest }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const flipRef = useRef<PageFlip | null>(null);
  const zoomRef = useRef<HTMLDialogElement>(null);
  const reducedMotion = useRef(false);

  const [slots, setSlots] = useState<HTMLElement[]>([]);
  const [index, setIndex] = useState(0);
  const [orientation, setOrientation] = useState<Orientation>("landscape");
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState<ReadonlySet<number>>(() => new Set([0, 1, 2]));
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = pageFromQuery(new URLSearchParams(window.location.search).get("page"));
    setIndex(start);

    const block = document.createElement("div");
    block.className = "book-block";
    host.appendChild(block);

    const elements = BOOK_PAGES.map((_, i) => {
      const el = document.createElement("div");
      el.className = "book-page book-light";
      el.dataset.density = isHardPage(i) ? "hard" : "soft";
      return el;
    });
    setSlots(elements);

    let cancelled = false;
    let instance: PageFlip | null = null;

    import("page-flip").then(({ PageFlip }) => {
      if (cancelled) return;
      instance = new PageFlip(block, {
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
        size: "stretch",
        // Two pages side by side need at least 2 × minWidth of room; below
        // that the book closes to one page at a time.
        minWidth: 300,
        maxWidth: 680,
        minHeight: 424,
        maxHeight: 962,
        showCover: true,
        usePortrait: true,
        startPage: start,
        drawShadow: true,
        maxShadowOpacity: 0.45,
        flippingTime: reducedMotion.current ? 1 : 850,
        showPageCorners: !reducedMotion.current,
        // A click on a page is someone using it — a link, a checkbox — not
        // asking to turn it. Turning is a drag, a swipe or the controls.
        disableFlipByClick: true,
        mobileScrollSupport: true,
        clickEventForward: true,
        useMouseEvents: true,
      });
      instance.on("flip", (event) => setIndex(event.data));
      instance.on("changeOrientation", (event) => setOrientation(event.data));
      instance.on("init", (event) => {
        setIndex(event.data.page);
        setOrientation(event.data.mode);
        setReady(true);
      });
      instance.loadFromHTML(elements);
      flipRef.current = instance;
    });

    return () => {
      cancelled = true;
      flipRef.current = null;
      if (instance) instance.destroy();
      else block.remove();
      setSlots([]);
      setReady(false);
    };
  }, []);

  const visible = orientation === "portrait" ? [index] : spreadOf(index);

  // Load outwards from wherever the reader is, and keep what has loaded: a
  // widget someone has been playing with should still be there on the way back.
  useEffect(() => {
    setLoaded((previous) => {
      const next = new Set(previous);
      for (let i = index - LOAD_RADIUS; i <= index + LOAD_RADIUS; i++) {
        if (i >= 0 && i < PAGE_COUNT) next.add(i);
      }
      return next.size === previous.size ? previous : next;
    });
  }, [index]);

  // `?page=N` follows the reader, so a link can open the book at a rule.
  useEffect(() => {
    if (!ready) return;
    const url = new URL(window.location.href);
    if (index === 0) url.searchParams.delete("page");
    else url.searchParams.set("page", String(index + 1));
    window.history.replaceState(window.history.state, "", url);
  }, [index, ready]);

  const goTo = useCallback((target: number) => {
    const book = flipRef.current;
    if (!book) return;
    const clamped = Math.min(Math.max(target, 0), PAGE_COUNT - 1);
    // Backwards in portrait cannot animate (see `step`), so it turns directly.
    const backwardsOnPhone =
      book.getOrientation() === "portrait" && clamped < book.getCurrentPageIndex();
    if (reducedMotion.current || backwardsOnPhone) {
      book.turnToPage(clamped);
      setIndex(clamped);
    } else {
      book.flip(clamped);
    }
  }, []);

  /**
   * One page on a phone, one spread on a desktop.
   *
   * page-flip animates a backward turn by pretending to grab the left page's
   * corner, and in portrait mode there is no left page on screen to grab — the
   * turn silently does nothing, and flip(index) takes the same route. So a
   * single page goes back by turning straight to it; swiping still animates.
   */
  const step = useCallback(
    (direction: 1 | -1) => {
      const book = flipRef.current;
      if (!book) return;
      const current = book.getCurrentPageIndex();
      if (book.getOrientation() === "portrait") {
        const target = Math.min(Math.max(current + direction, 0), PAGE_COUNT - 1);
        if (direction === 1 && !reducedMotion.current) {
          book.flipNext();
        } else {
          book.turnToPage(target);
          setIndex(target);
        }
      } else if (reducedMotion.current) {
        const spread = spreadOf(current);
        goTo(
          direction === 1 ? (spread[spread.length - 1] ?? current) + 1 : (spread[0] ?? current) - 1,
        );
      } else if (direction === 1) {
        book.flipNext();
      } else {
        book.flipPrev();
      }
    },
    [goTo],
  );

  const next = useCallback(() => step(1), [step]);
  const prev = useCallback(() => step(-1), [step]);

  const jumpToPdfPage = useCallback((pdfPage: number) => goTo(pdfPageIndex(pdfPage)), [goTo]);

  // Arrow keys turn pages, except while someone is typing in a field or moving
  // a slider — those keys belong to the control.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true'], dialog[open]"))
        return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "ArrowRight" || event.key === "PageDown") next();
      else if (event.key === "ArrowLeft" || event.key === "PageUp") prev();
      else if (event.key === "Home") goTo(0);
      else if (event.key === "End") goTo(PAGE_COUNT - 1);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, goTo]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stageRef.current?.requestFullscreen?.();
  };

  const contents = contentsEntries(manifest);
  const zoomable = visible
    .map((i) => BOOK_PAGES[i])
    .flatMap((page) => (page?.kind === "pdf" ? [page.pdfPage] : []));
  const first = visible[0] ?? 0;
  const last = visible[visible.length - 1] ?? first;
  const counter =
    first === last
      ? `Page ${first + 1} of ${PAGE_COUNT}`
      : `Pages ${first + 1}–${last + 1} of ${PAGE_COUNT}`;
  const currentSection = [...contents].reverse().find((entry) => entry.index <= last);

  return (
    <div
      ref={stageRef}
      className={`book-stage ${fullscreen ? "book-stage--fullscreen" : ""}`}
      aria-roledescription="flip book"
    >
      <div className="relative">
        <div ref={hostRef} className={`book-host ${ready ? "" : "book-host--loading"}`} />
        {!ready ? (
          <div className="book-placeholder" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={manifest.pages[0]?.srcSmall} alt="" />
          </div>
        ) : null}

        <button
          type="button"
          onClick={prev}
          disabled={index === 0}
          className="book-arrow book-arrow--prev"
          aria-label="Previous page"
        >
          <Chevron direction="left" />
        </button>
        <button
          type="button"
          onClick={next}
          disabled={last >= PAGE_COUNT - 1}
          className="book-arrow book-arrow--next"
          aria-label="Next page"
        >
          <Chevron direction="right" />
        </button>
      </div>

      <div className="book-toolbar" role="toolbar" aria-label="Rulebook controls">
        <button type="button" onClick={prev} disabled={index === 0} className="book-tool">
          <Chevron direction="left" />
          <span className="sr-only sm:not-sr-only">Previous</span>
        </button>

        <label className="book-contents">
          <span className="sr-only">Jump to a section</span>
          <select
            value={currentSection ? String(currentSection.index) + "|" + currentSection.label : ""}
            onChange={(event) => {
              const target = Number(event.target.value.split("|")[0]);
              if (Number.isFinite(target)) goTo(target);
            }}
          >
            <option value="" disabled>
              Contents
            </option>
            <option value={`0|Cover`}>Cover</option>
            {contents.map((entry) => (
              <option key={entry.label} value={`${entry.index}|${entry.label}`}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>

        <p className="book-counter" aria-live="polite">
          <span>{counter}</span>
          <span className="sr-only">
            : {visible.map((i) => (BOOK_PAGES[i] ? describePage(BOOK_PAGES[i]!) : "")).join(", ")}
          </span>
        </p>

        <button
          type="button"
          className="book-tool"
          onClick={() => zoomRef.current?.showModal()}
          disabled={zoomable.length === 0}
        >
          <ZoomIcon />
          <span className="sr-only sm:not-sr-only">Zoom</span>
        </button>
        <button type="button" className="book-tool max-sm:hidden" onClick={toggleFullscreen}>
          <FullscreenIcon exit={fullscreen} />
          <span className="sr-only lg:not-sr-only">
            {fullscreen ? "Exit full screen" : "Full screen"}
          </span>
        </button>
        <a href={manifest.pdf} download className="book-tool">
          <DownloadIcon />
          <span className="sr-only sm:not-sr-only">PDF</span>
        </a>
        <button
          type="button"
          onClick={next}
          disabled={last >= PAGE_COUNT - 1}
          className="book-tool"
        >
          <span className="sr-only sm:not-sr-only">Next</span>
          <Chevron direction="right" />
        </button>
      </div>

      <p className="book-hint">
        {orientation === "portrait" ? "Swipe" : "Drag a page corner"} to turn the page &middot; the
        pages marked <strong>A</strong> are interactive
      </p>

      <dialog
        ref={zoomRef}
        className="book-zoom"
        aria-label="Zoomed rulebook pages"
        onClick={(event) => {
          if (event.target === zoomRef.current) zoomRef.current?.close();
        }}
      >
        <div className="book-zoom-bar">
          <span>{counter}</span>
          <button type="button" className="book-tool" onClick={() => zoomRef.current?.close()}>
            Close
          </button>
        </div>
        <div className="book-zoom-pages">
          {zoomable.map((pdfPage) => {
            const page = manifest.pages[pdfPage - 1];
            return page ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={pdfPage} src={page.src} alt={`Rulebook page ${pdfPage}`} />
            ) : null;
          })}
        </div>
      </dialog>

      {slots.map((slot, i) => {
        const page = BOOK_PAGES[i];
        if (!page) return null;
        const load = loaded.has(i);
        let content;
        switch (page.kind) {
          case "pdf":
            content = (
              <PdfPage
                manifest={manifest}
                pdfPage={page.pdfPage}
                load={load}
                onJump={jumpToPdfPage}
              />
            );
            break;
          case "widget":
            content = (
              <WidgetPage
                manifest={manifest}
                widget={page.widget}
                section={page.section}
                title={page.title}
                badge={badgeLabel(page) ?? ""}
                load={load}
              />
            );
            break;
          case "inside-back":
            content = <InsideBackCover manifest={manifest} load={load} />;
            break;
          case "back-cover":
            content = <BackCover manifest={manifest} load={load} />;
            break;
        }
        return createPortal(content, slot, `page-${i}`);
      })}
    </div>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width="18"
      height="18"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={direction === "left" ? "M12.5 4.5 7 10l5.5 5.5" : "M7.5 4.5 13 10l-5.5 5.5"} />
    </svg>
  );
}

function ZoomIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      width="18"
      height="18"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <circle cx="8.5" cy="8.5" r="5" />
      <path d="m12.5 12.5 4 4M8.5 6.5v4M6.5 8.5h4" />
    </svg>
  );
}

function FullscreenIcon({ exit }: { exit: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width="18"
      height="18"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {exit ? (
        <path d="M7.5 3v4.5H3M12.5 3v4.5H17M7.5 17v-4.5H3M12.5 17v-4.5H17" />
      ) : (
        <path d="M3 7.5V3h4.5M17 7.5V3h-4.5M3 12.5V17h4.5M17 12.5V17h-4.5" />
      )}
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      width="18"
      height="18"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 3v10M5.5 8.5 10 13l4.5-4.5M4 17h12" />
    </svg>
  );
}
