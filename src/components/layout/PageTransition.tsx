"use client";

import { usePathname } from "next/navigation";

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

  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  );
}
