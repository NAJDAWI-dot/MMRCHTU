/**
 * A mouse, small enough to sit inside a menu item.
 *
 * Cheddar himself is a full character drawing — ears, eyes, paws, tail — and
 * at 16px all of that collapses into grey mush. This is the same animal
 * reduced to the two things that still read at that size: a round head and two
 * oversized ears.
 *
 * Filled in `currentColor`, so it takes the colour of whatever it sits in and
 * needs no separate light and dark version. Decorative throughout: it always
 * appears beside a text label, never instead of one.
 */
export function MouseMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
      fill="currentColor"
    >
      {/* Ears first, so the head sits over where they join. */}
      <circle className="mouse-mark-ear" cx="6.6" cy="7.4" r="4" />
      <circle className="mouse-mark-ear" cx="17.4" cy="7.4" r="4" />
      <ellipse cx="12" cy="14.6" rx="7.2" ry="6.4" />
      {/* The tail, drawn rather than filled, so it reads as a line at any size. */}
      <path
        d="M19 18.4c2.6-.4 3.4-2.2 2.6-3.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
