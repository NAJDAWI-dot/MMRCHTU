import { MazeTrail } from "@/components/brand/MazeTrail";

/**
 * Route-segment loading UI. The App Router shows this automatically while a
 * server component streams — most visibly on /faq, which waits on a database
 * query.
 */
export default function Loading() {
  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center gap-5"
      // Polite rather than assertive: a route change is not an interruption.
      role="status"
      aria-live="polite"
    >
      <MazeTrail size={120} className="text-ras-purple dark:text-white" motion="loop" />
      <p className="text-sm uppercase tracking-[0.2em] text-ras-gray dark:text-white/70">
        Loading…
      </p>
    </div>
  );
}
