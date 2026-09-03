import { cache } from "react";
import { earlyBirdState, type EarlyBirdState } from "@/lib/early-bird";
import { getPaymentConfig } from "@/lib/site-config";

/**
 * Whether the early-bird discount is running, for the parts of the site that
 * advertise it.
 *
 * The half that touches the database. The pure half — deriving what the site
 * should say from what the admin configured — lives in @/lib/early-bird and is
 * tested there. Same division, for the same reason, as pages.ts and
 * page-visibility.ts.
 *
 * Kept out of site-config.ts deliberately, despite reading one of its rows.
 * React's `cache` only exists under the server condition, so a module that
 * calls it at the top level cannot be imported by anything that runs outside a
 * render — and site-config is pulled in by lib/registration, which the unit
 * tests exercise directly.
 *
 * Cached for the same reason hiddenPageHrefs is: the Nav sits in the root
 * layout and asks on every page in the site, and on /register the layout's
 * banner and its notice both ask during one render. One query either way.
 *
 * Returns only whether the offer is on, by how much, and until when. The row it
 * reads also holds the CliQ alias and the tier prices, and those stay behind —
 * see the note at the top of app/register/page.tsx.
 */
export const getEarlyBirdState = cache(async (): Promise<EarlyBirdState> => {
  return earlyBirdState(await getPaymentConfig());
});
