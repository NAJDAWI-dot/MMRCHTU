import { revalidatePath } from "next/cache";

/**
 * Clears every page that shows competition day data: the whole day site, the
 * homepage (which is the day site while it is public) and the HQ desks. One
 * call after any write, so no desk has to remember which pages read what.
 */
export function refreshDaySite() {
  revalidatePath("/day", "layout");
  revalidatePath("/");
  revalidatePath("/day/hq", "layout");
}
