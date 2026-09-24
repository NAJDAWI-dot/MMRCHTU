import type { Metadata } from "next";
import { DayIcon } from "@/components/day-site/icons";
import { SponsorLogo } from "@/components/day-site/SponsorLogo";
import { requireSection } from "@/lib/admin-access";
import { MAX_UPLOAD_BYTES, formatBytes } from "@/lib/gallery";
import { isStorageConfigured } from "@/lib/photo-storage";
import { prisma } from "@/lib/prisma";
import { SPONSOR_NAME_MAX, SPONSOR_TIER_MAX } from "@/lib/sponsors";
import { ArmedForm, DeskForm, DeskHead, Submit, Toggle } from "../DeskKit";
import { addSponsor, deleteSponsor, moveSponsor, saveSponsor } from "./actions";
import { openDaySite } from "@/lib/day-links";

export const metadata: Metadata = { title: "Sponsors" };

const LOGO_TYPES = "image/png,image/webp,image/jpeg,image/avif";

/**
 * The sponsors on the hall screen's sponsors slide: add them with their logos,
 * put them in order, group them by tier, hide one for a while.
 */
export default async function SponsorsDeskPage() {
  await requireSection("/day/hq/sponsors");
  const sponsors = await prisma.sponsor.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  const shown = sponsors.filter((sponsor) => sponsor.isPublished).length;

  return (
    <div className="space-y-8">
      <DeskHead
        icon="star"
        title="Sponsors"
        lead="The sponsors slide on the hall screen. Sponsors with the same tier are shown together, in the order of this list."
      >
        <a href={openDaySite("/day/screen?panel=sponsors")} target="_blank" className="day-btn day-btn-soft day-btn-sm">
          <DayIcon name="expand" className="h-4 w-4" />
          See the slide
        </a>
      </DeskHead>

      {isStorageConfigured() ? null : (
        <p className="day-card border-day-live/30 p-5 text-sm text-day-live">
          Photo storage is not connected on this deployment, so logos cannot be uploaded. Sponsors can still be added by name.
        </p>
      )}

      {/* ---------------------------------------------------------- add */}
      <section className="day-card p-5 sm:p-6" aria-labelledby="add-title">
        <p className="day-kicker">Add a sponsor</p>
        <h2 id="add-title" className="sr-only">
          Add a sponsor
        </h2>
        <DeskForm action={addSponsor} resetOnSuccess className="mt-4 space-y-4">
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-3">
            <div>
              <label className="day-label" htmlFor="new-name">
                Name
              </label>
              <input id="new-name" name="name" required maxLength={SPONSOR_NAME_MAX} className="day-input" />
            </div>
            <div>
              <label className="day-label" htmlFor="new-tier">
                Tier (optional)
              </label>
              <input id="new-tier" name="tier" maxLength={SPONSOR_TIER_MAX} placeholder="Gold sponsor" className="day-input" />
            </div>
            <div>
              <label className="day-label" htmlFor="new-website">
                Website (optional)
              </label>
              <input id="new-website" name="website" inputMode="url" placeholder="acme.com" className="day-input" />
            </div>
          </div>
          <div>
            <label className="day-label" htmlFor="new-logo">
              Logo
            </label>
            <input id="new-logo" name="logo" type="file" accept={LOGO_TYPES} className="day-input py-2" />
            <p className="mt-1.5 text-xs text-day-muted">
              A PNG with a transparent background looks best. Up to {formatBytes(MAX_UPLOAD_BYTES)}. Without one, the name is shown instead.
            </p>
          </div>
          <Submit pending="Adding…">Add the sponsor</Submit>
        </DeskForm>
      </section>

      {/* --------------------------------------------------------- list */}
      <section className="space-y-4" aria-labelledby="list-title">
        <h2 id="list-title" className="day-kicker">
          {sponsors.length ? `${sponsors.length} sponsor${sponsors.length === 1 ? "" : "s"} · ${shown} on the slide` : "No sponsors yet"}
        </h2>
        {sponsors.length ? (
          <ol className="space-y-3">
            {sponsors.map((sponsor, index) => (
              <li key={sponsor.id} className={`day-card p-4 sm:p-5 ${sponsor.isPublished ? "" : "opacity-70"}`}>
                <div className="grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-[12rem_minmax(0,1fr)]">
                  <div className="space-y-3">
                    <SponsorLogo name={sponsor.name} logoUrl={sponsor.logoUrl} className="aspect-[3/2] w-full p-3" nameClass="text-xl" />
                    <div className="flex items-center gap-2">
                      <DeskForm action={moveSponsor} className="flex">
                        <input type="hidden" name="id" value={sponsor.id} />
                        <input type="hidden" name="direction" value="up" />
                        <button type="submit" disabled={index === 0} aria-label={`Move ${sponsor.name} up`} className="day-btn day-btn-soft day-btn-sm disabled:opacity-40">
                          ↑
                        </button>
                      </DeskForm>
                      <DeskForm action={moveSponsor} className="flex">
                        <input type="hidden" name="id" value={sponsor.id} />
                        <input type="hidden" name="direction" value="down" />
                        <button
                          type="submit"
                          disabled={index === sponsors.length - 1}
                          aria-label={`Move ${sponsor.name} down`}
                          className="day-btn day-btn-soft day-btn-sm disabled:opacity-40"
                        >
                          ↓
                        </button>
                      </DeskForm>
                      {sponsor.isPublished ? null : <span className="text-xs font-semibold text-day-faint">Hidden</span>}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <DeskForm action={saveSponsor} className="space-y-4">
                      <input type="hidden" name="id" value={sponsor.id} />
                      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-3">
                        <div>
                          <label className="day-label" htmlFor={`name-${sponsor.id}`}>
                            Name
                          </label>
                          <input id={`name-${sponsor.id}`} name="name" required maxLength={SPONSOR_NAME_MAX} defaultValue={sponsor.name} className="day-input" />
                        </div>
                        <div>
                          <label className="day-label" htmlFor={`tier-${sponsor.id}`}>
                            Tier
                          </label>
                          <input id={`tier-${sponsor.id}`} name="tier" maxLength={SPONSOR_TIER_MAX} defaultValue={sponsor.tier} className="day-input" />
                        </div>
                        <div>
                          <label className="day-label" htmlFor={`website-${sponsor.id}`}>
                            Website
                          </label>
                          <input id={`website-${sponsor.id}`} name="website" inputMode="url" defaultValue={sponsor.website} className="day-input" />
                        </div>
                      </div>
                      <div className="grid grid-cols-[minmax(0,1fr)] items-end gap-3 sm:grid-cols-2">
                        <div>
                          <label className="day-label" htmlFor={`logo-${sponsor.id}`}>
                            {sponsor.logoUrl ? "Replace the logo" : "Add a logo"}
                          </label>
                          <input id={`logo-${sponsor.id}`} name="logo" type="file" accept={LOGO_TYPES} className="day-input py-2" />
                        </div>
                        {sponsor.logoUrl ? (
                          <label className="flex items-center gap-2 pb-3 text-sm text-day-ink">
                            <input type="checkbox" name="removeLogo" /> Remove the logo and show the name
                          </label>
                        ) : null}
                      </div>
                      <Toggle name="isPublished" defaultChecked={sponsor.isPublished} label="On the sponsors slide" />
                      <Submit pending="Saving…" variant="secondary">
                        Save
                      </Submit>
                    </DeskForm>
                    <ArmedForm action={deleteSponsor} label="Delete" destructive warning={`${sponsor.name} and its logo are deleted.`} confirm="Delete">
                      <input type="hidden" name="id" value={sponsor.id} />
                    </ArmedForm>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="day-card p-6 text-day-muted">Add the first sponsor above. The hall screen shows a sponsors slide once there is one.</p>
        )}
      </section>
    </div>
  );
}
