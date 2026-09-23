"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";

/**
 * How the day site moves: smooth scrolling, and content that rises into place
 * as it comes into view.
 *
 * Lenis eases the wheel and trackpad into one continuous glide. It leaves touch
 * scrolling to the phone, which already does it better than any script, and it
 * is not started at all for anyone who asked for reduced motion.
 *
 * Anything marked data-reveal starts hidden only once this has run and put
 * `day-motion` on the page, so with no script, or with reduced motion, nothing
 * is ever hidden. A mutation observer picks up content added by a navigation or
 * a refresh, which is how a page's new cards still arrive the same way.
 */
export function DayMotion() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;
    root.classList.add("day-motion");

    const lenis = new Lenis({ duration: 1.15, smoothWheel: true, anchors: true, easing: (t) => 1 - Math.pow(1 - t, 4) });
    let frame = requestAnimationFrame(function raf(time) {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    });

    const seen = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-in");
          seen.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    const watch = (scope: ParentNode) => {
      scope.querySelectorAll?.("[data-reveal]:not(.is-in)").forEach((node) => seen.observe(node));
    };
    watch(document);
    const added = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.matches("[data-reveal]:not(.is-in)")) seen.observe(node);
          watch(node);
        });
      }
    });
    added.observe(document.body, { childList: true, subtree: true });

    (window as unknown as { __dayLenis?: Lenis }).__dayLenis = lenis;
    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
      seen.disconnect();
      added.disconnect();
      root.classList.remove("day-motion");
      delete (window as unknown as { __dayLenis?: Lenis }).__dayLenis;
    };
  }, []);

  // A new page starts at the top, without gliding there from the old one.
  useEffect(() => {
    const lenis = (window as unknown as { __dayLenis?: Lenis }).__dayLenis;
    lenis?.scrollTo(0, { immediate: true, force: true });
  }, [pathname]);

  return null;
}
