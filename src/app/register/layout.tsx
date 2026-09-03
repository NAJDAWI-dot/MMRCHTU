import { EarlyBirdMarquee } from "@/components/promo/EarlyBirdMarquee";
import { EarlyBirdNotice } from "@/components/promo/EarlyBirdNotice";

import { guardHiddenPage } from "@/lib/page-visibility";
import { getEarlyBirdState } from "@/lib/early-bird-server";

/**
 * 404s this route while hidden. See guardHiddenPage.
 *
 * Distinct from RegisterFormConfig.isOpen, which keeps the page up and explains
 * that registration has closed. Hiding it removes the page entirely, which is
 * the right thing before it opens and the wrong thing after it shuts.
 *
 * The discount banner hangs here rather than in page.tsx for two reasons. It
 * sits outside that page's max-w-lg column, so the ribbon can run the full width
 * of the window without fighting its way out of a centred container; and it
 * covers all three things that page can render — the form, a status lookup, and
 * a bad reference — without any of them having to remember to include it.
 *
 * Note that this reads the discount and nothing else. The comment at the top of
 * page.tsx explains why payment configuration is kept out of this route's
 * markup: getEarlyBirdState returns only whether the offer is on, by how much,
 * and until when. The CliQ alias and bank details on that same row stay where
 * they are, and still reach the browser only after step one.
 */
export default async function RegisterLayout({ children }: { children: React.ReactNode }) {
  await guardHiddenPage("/register");
  const earlyBird = await getEarlyBirdState();

  return (
    <>
      {earlyBird.active ? (
        <>
          <EarlyBirdMarquee />
          <div className="mx-auto max-w-lg px-4 pt-8">
            <EarlyBirdNotice percent={earlyBird.percent} cutoff={earlyBird.cutoff} />
          </div>
        </>
      ) : null}
      {children}
    </>
  );
}
