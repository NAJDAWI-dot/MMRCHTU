"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A sideways-scrolling frame that opens centred.
 *
 * The bracket is two halves meeting at the final. On a screen too narrow for
 * all of it, opening at the left edge would show one half and hide the final;
 * opening in the middle shows the final and both semi-finals, with the outer
 * rounds a short scroll away on either side.
 */
export function CenteredScroll({ className = "", children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const frame = ref.current;
    if (frame) frame.scrollLeft = (frame.scrollWidth - frame.clientWidth) / 2;
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
