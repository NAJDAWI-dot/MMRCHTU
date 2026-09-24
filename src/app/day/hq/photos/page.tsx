import type { Metadata } from "next";
import Link from "next/link";
import { DayIcon } from "@/components/day-site/icons";
import { requireSection, rolesOf } from "@/lib/admin-access";
import { postedAgo } from "@/lib/day-mode";
import { loadDayPhotos } from "@/lib/day-photos";
import { isStorageConfigured } from "@/lib/photo-storage";
import { canOpen } from "@/lib/roles";
import { DeskForm, DeskHead, Submit } from "../DeskKit";
import { startDayAlbum, takeDownPhoto } from "./actions";
import { DayPhotoUploader } from "./DayPhotoUploader";
import { openDaySite } from "@/lib/day-links";

export const metadata: Metadata = { title: "Photos" };

/**
 * Live photos: whoever is shooting in the hall adds them from a phone, and
 * they show on the day site's Photos page and on the hall screen. Anything
 * that should not be up comes down from here.
 */
export default async function PhotosDeskPage() {
  const admin = await requireSection("/day/hq/photos");
  const { album, photos, count } = await loadDayPhotos(60);
  const now = new Date();

  return (
    <div className="space-y-8">
      <DeskHead
        icon="camera"
        title="Photos"
        lead="Shoot in the hall and add them here. They go on the day site's Photos page and the hall screen straight away."
      >
        {album ? (
          <div className="flex flex-wrap gap-2">
            <a href={openDaySite("/day/photos")} className="day-btn day-btn-soft day-btn-sm">
              <DayIcon name="live" className="h-4 w-4" />
              Photos page
            </a>
            {canOpen(rolesOf(admin), "/admin/gallery") ? (
              <Link href={`/admin/gallery/${album.id}`} className="day-btn day-btn-soft day-btn-sm">
                <DayIcon name="gear" className="h-4 w-4" />
                In the gallery
              </Link>
            ) : null}
          </div>
        ) : null}
      </DeskHead>

      {isStorageConfigured() ? null : (
        <p className="day-card border-day-live/30 p-5 text-sm text-day-live">
          Photo storage is not connected on this deployment, so uploads will fail. Attach the Blob store in Vercel and redeploy.
        </p>
      )}

      {album ? (
        <>
          <section className="day-card p-5 sm:p-6">
            <p className="day-kicker">Add photos</p>
            <p className="day-display mt-2 text-2xl text-day-ink">{album.title}</p>
            <p className="mt-1 text-sm text-day-muted">
              {count} photo{count === 1 ? "" : "s"} so far.{" "}
              {album.isPublished
                ? "The album is also published in the main gallery."
                : "The album stays out of the main gallery until someone publishes it there."}
            </p>
            <div className="mt-6">
              <DayPhotoUploader />
            </div>
          </section>

          <section className="space-y-4" aria-labelledby="latest-title">
            <h2 id="latest-title" className="day-kicker">
              Latest{count > photos.length ? ` ${photos.length} of ${count}` : ""}
            </h2>
            {photos.length ? (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {photos.map((photo) => (
                  <li key={photo.id} className="day-card overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={photo.caption || "A photo from the hall"}
                      width={photo.width ?? undefined}
                      height={photo.height ?? undefined}
                      loading="lazy"
                      className="aspect-[4/3] w-full bg-day-ink/[0.06] object-cover"
                    />
                    <div className="space-y-2 p-3">
                      <p className="truncate text-sm text-day-ink">{photo.caption || <span className="text-day-faint">No caption</span>}</p>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-day-faint">{postedAgo(photo.createdAt, now)}</span>
                        <DeskForm action={takeDownPhoto} className="flex flex-col items-end gap-2">
                          <input type="hidden" name="id" value={photo.id} />
                          <Submit pending="…" variant="danger" size="sm">
                            Take down
                          </Submit>
                        </DeskForm>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="day-card p-6 text-day-muted">Nothing yet. The first photo you add shows here, on the Photos page and on the hall screen.</p>
            )}
          </section>
        </>
      ) : (
        <section className="day-card max-w-2xl p-5 sm:p-6">
          <p className="day-kicker">Before the first photo</p>
          <p className="day-display mt-2 text-2xl text-day-ink">Start the day album</p>
          <p className="mt-1 text-sm text-day-muted">
            One album holds the day&rsquo;s photos. It is a normal gallery album, kept out of the main gallery until someone publishes it there.
          </p>
          <DeskForm action={startDayAlbum} className="mt-5 space-y-4">
            <div>
              <label className="day-label" htmlFor="album-title">
                Album name
              </label>
              <input id="album-title" name="title" defaultValue="MMRC 26 Competition Day" className="day-input" />
            </div>
            <Submit pending="Starting…">Start the album</Submit>
          </DeskForm>
        </section>
      )}
    </div>
  );
}
