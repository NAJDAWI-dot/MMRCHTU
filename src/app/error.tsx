"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

/**
 * What a visitor sees when a page throws.
 *
 * Without this file Next shows its own error screen — in production a bare
 * "Application error: a client-side exception has occurred", which tells the
 * visitor nothing and offers them nowhere to go. A database hiccup on any of
 * the seven database-backed pages is enough to trigger it.
 *
 * Must be a client component and must accept `reset`: that is the contract
 * Next uses to let the segment re-render without a full page load, which is
 * often all a transient failure needs.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Vercel captures console output, so this is what turns an anonymous
    // production failure into something searchable. `digest` is the id Next
    // puts in the server logs for the same error.
    console.error("Page error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
        Something went wrong
      </p>
      <h1 className="mt-3 font-display text-3xl font-extrabold text-ras-purple dark:text-white">
        That page did not load
      </h1>
      <p className="mt-4 text-ras-gray dark:text-white/70">
        This is usually temporary. Try again, and if it keeps happening let the organizing
        committee know.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button variant="ghost" asChild>
          <Link href="/">Back to the homepage</Link>
        </Button>
      </div>

      {/* Shown so someone reporting the problem can quote it. Meaningless on
          its own, which is why it is small and unlabelled beyond this. */}
      {error.digest ? (
        <p className="mt-8 font-mono text-xs text-ras-gray/70 dark:text-white/40">
          Reference: {error.digest}
        </p>
      ) : null}
    </div>
  );
}
