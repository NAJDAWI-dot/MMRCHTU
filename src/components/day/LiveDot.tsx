/**
 * The red dot that says "this is happening now".
 *
 * The ring pulses, the dot does not, so the dot is still readable as a dot for
 * anyone with reduced motion on, where the ring simply is not drawn.
 */
export function LiveDot({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`relative inline-flex h-2.5 w-2.5 shrink-0 ${className}`}>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ras-crimson opacity-60 motion-reduce:hidden dark:bg-mood-rose" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-ras-crimson dark:bg-mood-rose" />
    </span>
  );
}
