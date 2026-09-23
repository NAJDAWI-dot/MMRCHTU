"use client";

import { usePathname } from "next/navigation";

/** Whether a path belongs to the competition day site, which brings its own chrome. */
export function isDaySitePath(pathname: string | null): boolean {
  return pathname === "/day" || !!pathname?.startsWith("/day/");
}

/**
 * Renders the main site's chrome everywhere except the day site.
 *
 * The day site is a different site on the same app: its own bar, its own
 * background, its own footer. Server components (the header, the footer) can be
 * passed in as children, so they still render on the server; this only decides
 * whether they appear. usePathname is available during the server render too,
 * so the day site never flashes the main header before hiding it.
 */
export function ChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (isDaySitePath(pathname)) return null;
  return <>{children}</>;
}
