"use client";

import { useState } from "react";

/**
 * The search input.
 *
 * A plain GET form, deliberately: the results page reads `?q=`, so submitting
 * this navigates to a real, linkable, shareable URL — and it works with
 * JavaScript disabled or still loading. The only thing the client component
 * adds is a controlled value so the box can be cleared.
 */
export function SearchBox({
  initialQuery = "",
  autoFocus = false,
}: {
  initialQuery?: string;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState(initialQuery);

  return (
    <form action="/search" method="get" role="search" className="flex flex-wrap gap-2">
      <label htmlFor="site-search" className="sr-only">
        Search the rulebook and FAQ
      </label>
      <input
        id="site-search"
        name="q"
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="footprint, speed run, eligibility…"
        // eslint-disable-next-line jsx-a11y/no-autofocus -- the search page has
        // one purpose, and a visitor who navigated to it is here to type.
        autoFocus={autoFocus}
        className="min-h-[44px] min-w-0 flex-1 rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-3 text-ras-purple transition-colors focus-visible:border-ras-purple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ras-purple/40 dark:text-white dark:focus-visible:border-white dark:focus-visible:ring-white/30"
      />
      <button
        type="submit"
        className="min-h-[44px] rounded-md bg-ras-purple px-4 text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-mood-plum active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        Search
      </button>
    </form>
  );
}
