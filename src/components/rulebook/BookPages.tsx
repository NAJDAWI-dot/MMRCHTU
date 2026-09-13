"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { ClientManifest, WidgetId } from "@/lib/rulebook-book";
import { MazeAnatomy } from "@/components/rules/MazeAnatomy";
import { RunComparison } from "@/components/rules/RunComparison";
import { RobotFootprint } from "@/components/rules/RobotFootprint";
import { ScoreFormula } from "@/components/rules/ScoreFormula";
import { ReadinessChecklist } from "@/components/rules/ReadinessChecklist";

/**
 * The four kinds of page the flip-book is bound from.
 *
 * Every measurement is a percentage of the page, taken from PDF points in the
 * manifest, so a page drawn 300px wide on a phone and 620px wide on a desktop
 * spread puts its links and its badge in exactly the same place on the print.
 */

type Rect = [number, number, number, number];

function box(rect: Rect, width: number, height: number) {
  const [x0, y0, x1, y1] = rect;
  return {
    left: `${(x0 / width) * 100}%`,
    top: `${(y0 / height) * 100}%`,
    width: `${((x1 - x0) / width) * 100}%`,
    height: `${((y1 - y0) / height) * 100}%`,
  };
}

/**
 * Presses inside this element never reach page-flip.
 *
 * page-flip starts a drag on `mousedown`/`touchstart` from its own container,
 * and only lets a press through when the target is literally an <a> or a
 * <button> — the thumb of a range input, the inside of an SVG or a label would
 * all start turning the page. React's synthetic handlers are no use here: they
 * run at the root, after page-flip has already seen the event on its way up. So
 * the listeners are native, on the element itself.
 */
function useNoFlip<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const stop = (event: Event) => event.stopPropagation();
    el.addEventListener("mousedown", stop);
    el.addEventListener("touchstart", stop, { passive: true });
    return () => {
      el.removeEventListener("mousedown", stop);
      el.removeEventListener("touchstart", stop);
    };
  }, []);
  return ref;
}

function PageImage({
  src,
  srcSmall,
  alt,
  load,
}: {
  src: string;
  srcSmall: string;
  alt: string;
  load: boolean;
}) {
  if (!load) return null;
  return (
    // A plain <img>: the pages are already sized WebP, and the optimiser would
    // only re-encode them. srcSet lets a phone take the 1x file.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      srcSet={`${srcSmall} 596w, ${src} 1191w`}
      sizes="(max-width: 640px) 100vw, 50vw"
      alt={alt}
      draggable={false}
      decoding="async"
      className="book-page-image"
    />
  );
}

export function PdfPage({
  manifest,
  pdfPage,
  load,
  onJump,
}: {
  manifest: ClientManifest;
  pdfPage: number;
  load: boolean;
  onJump: (pdfPage: number) => void;
}) {
  const page = manifest.pages[pdfPage - 1];
  if (!page) return null;

  return (
    <div className="book-sheet">
      <PageImage
        src={page.src}
        srcSmall={page.srcSmall}
        load={load}
        alt={pdfPage === 1 ? "MMRC26 Official Rulebook, front cover" : `Rulebook page ${pdfPage}`}
      />
      {page.links.map((link, i) =>
        link.uri ? (
          <a
            key={i}
            href={link.uri}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${link.uri}`}
            className="book-hotspot"
            style={box(link.rect, page.width, page.height)}
          />
        ) : link.page ? (
          <button
            key={i}
            type="button"
            aria-label={`Go to ${link.label ?? `page ${link.page}`}`}
            className="book-hotspot"
            style={box(link.rect, page.width, page.height)}
            onClick={() => onJump(link.page!)}
          />
        ) : null,
      )}
    </div>
  );
}

/**
 * A page the book adds, printed on the manual's own livery.
 *
 * The content is laid out at a fixed design width and scaled to the page, the
 * way print is: a diagram on a phone-sized page is the same diagram smaller,
 * not a reflowed one. Below a floor the scale stops shrinking and the layout
 * narrows instead, so the type stays readable.
 */
const DESIGN_WIDTH = 440;
const MIN_SCALE = 0.72;

function TemplatePage({
  manifest,
  badge,
  load,
  children,
}: {
  manifest: ClientManifest;
  badge: string | null;
  load: boolean;
  children: ReactNode;
}) {
  const t = manifest.template;
  const bodyRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 1, width: DESIGN_WIDTH, height: 0 });

  useEffect(() => {
    const body = bodyRef.current;
    const content = contentRef.current;
    if (!body || !content) return;
    const measure = () => {
      const available = body.clientWidth;
      if (!available) return;
      const scale = Math.max(MIN_SCALE, Math.min(1.1, available / DESIGN_WIDTH));
      const width = available / scale;
      setFit({ scale, width, height: content.offsetHeight * scale });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    observer.observe(content);
    measure();
    return () => observer.disconnect();
  }, []);

  return (
    <div className="book-sheet">
      <PageImage src={t.src} srcSmall={t.srcSmall} alt="" load={load} />
      {badge && t.badge ? (
        <span
          className="book-badge"
          style={box(
            [t.badge[0] - 8, t.badge[1] - 1, t.badge[2] + 8, t.badge[3] + 1],
            t.width,
            t.height,
          )}
          aria-hidden="true"
        >
          {badge}
        </span>
      ) : null}
      <div ref={bodyRef} className="book-body" style={box(t.body, t.width, t.height)}>
        <div style={{ height: fit.height || undefined }}>
          <div
            ref={contentRef}
            style={{
              width: fit.width,
              transform: `scale(${fit.scale})`,
              transformOrigin: "top left",
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function Widget({ id }: { id: WidgetId }) {
  switch (id) {
    case "maze":
      return <MazeAnatomy variant="page" />;
    case "runs":
      return <RunComparison variant="page" />;
    case "footprint":
      return <RobotFootprint variant="page" />;
    case "score":
      return <ScoreFormula variant="page" />;
    case "checklist":
      return (
        <div>
          <ReadinessChecklist groups={["On the day"]} compact />
          <Link
            href="/rules/checklist"
            className="mt-4 inline-flex min-h-[44px] items-center rounded-md bg-ras-purple px-4 text-sm font-semibold text-white transition-colors hover:bg-mood-plum"
          >
            Open the full checklist
          </Link>
        </div>
      );
  }
}

export function WidgetPage({
  manifest,
  widget,
  section,
  title,
  badge,
  load,
}: {
  manifest: ClientManifest;
  widget: WidgetId;
  section: string;
  title: string;
  badge: string;
  load: boolean;
}) {
  const noFlip = useNoFlip<HTMLDivElement>();

  return (
    <TemplatePage manifest={manifest} badge={badge} load={load}>
      <p className="book-kicker">Interactive page &middot; {section}</p>
      <h2 className="book-title">{title}</h2>
      <div ref={noFlip} data-no-flip className="mt-3">
        {/* Mounted only once the page is near, so five random mazes are not
            generated for a reader who only opened the cover. */}
        {load ? <Widget id={widget} /> : null}
      </div>
    </TemplatePage>
  );
}

export function InsideBackCover({ manifest, load }: { manifest: ClientManifest; load: boolean }) {
  const noFlip = useNoFlip<HTMLDivElement>();

  return (
    <TemplatePage manifest={manifest} badge={null} load={load}>
      <p className="book-kicker">MMRC26 &middot; Official Contest Manual</p>
      <h2 className="book-title">Keep the rulebook with you</h2>
      <p className="mt-3 font-serif text-[15px] leading-relaxed text-neutral-800">
        The PDF is the official rulebook. The interactive pages help explain it, but if they ever
        disagree, the judges follow the PDF.
      </p>
      <div ref={noFlip} data-no-flip className="mt-5 flex flex-col items-start gap-3">
        <a
          href={manifest.pdf}
          download
          className="inline-flex min-h-[44px] items-center rounded-md bg-ras-purple px-4 text-sm font-semibold text-white transition-colors hover:bg-mood-plum"
        >
          Download the PDF
        </a>
        <Link
          href="/rules/checklist"
          className="inline-flex min-h-[44px] items-center rounded-md border border-ras-purple/40 px-4 text-sm font-semibold text-ras-purple transition-colors hover:bg-ras-purple/5"
        >
          Run the readiness checklist
        </Link>
        <a
          href="https://www.mmrchtu.tech/"
          className="inline-flex min-h-[44px] items-center text-sm font-semibold text-ras-crimson hover:underline"
        >
          www.mmrchtu.tech
        </a>
      </div>
      <p className="mt-6 font-serif text-[13px] italic leading-relaxed text-neutral-600">
        We send rulebook updates to the email address you registered with, so keep an eye on it
        before competition day.
      </p>
    </TemplatePage>
  );
}

export function BackCover({ manifest, load }: { manifest: ClientManifest; load: boolean }) {
  return (
    <div className="book-sheet book-back-cover">
      {load ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={manifest.coverArt}
          alt=""
          draggable={false}
          className="book-page-image book-back-art"
        />
      ) : null}
      <div className="book-back-panel">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo/mmrc-mark.png" alt="" className="h-14 w-auto" draggable={false} />
        <p className="book-back-wordmark">MMRC 26</p>
        <p className="book-back-line">Micromouse Maze Solver Contest</p>
        <div className="book-back-rule" aria-hidden="true" />
        <p className="book-back-line">
          IEEE RAS Student Branch Chapter
          <br />
          Al-Hussein Technical University
        </p>
        <p className="book-back-url">www.mmrchtu.tech</p>
      </div>
    </div>
  );
}
