/**
 * Links from Day HQ into the day site go through /day/hq/open, which turns
 * draft mode back on for a signed-in admin before opening the page. See that
 * route for why.
 */
export function openDaySite(path = "/day"): string {
  return `/day/hq/open?to=${encodeURIComponent(path)}`;
}

/** Where /day/hq/open may send someone: a day site page, or /day for anything else. */
export function dayTarget(to: string | null): string {
  const path = to ?? "";
  return /^\/day(\/[\w\-/]*)?(\?[\w=&-]*)?$/.test(path) && !path.startsWith("/day/hq/open") ? path : "/day";
}
