"use client";

import { usePathname } from "next/navigation";
import { isDaySitePath } from "@/components/layout/ChromeGate";

/**
 * Fades each route in as it arrives.
 *
 * Client-side navigation swaps the page's markup in place, with no paint
 * between the old page and the new one — so moving between pages read as an
 * instant substitution rather than as going somewhere. This gives the
 * transition a beat.
 *
 * Keyed on the pathname because that is what makes the animation replay:
 * `<main>` itself never unmounts across navigations, so an animation declared
 * on it would run once on first load and never again. The key remounts this
 * wrapper on every route change instead.
 *
 * Remounting also discards the outgoing page's component state, which is the
 * correct behaviour here — that state belongs to a page the visitor has left.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Not on the day site. An element with a transform animation, even one that
  // has finished at `transform: none`, becomes the containing block for every
  // position: fixed descendant, so the day site's splash and alert pop-ups
  // centred themselves on the whole page instead of on the screen. The day
  // site fades its own content in, on an element that holds neither.
  return (
    <div key={pathname} className={isDaySitePath(pathname) ? undefined : "page-enter"}>
      {children}
    </div>
  );
}
