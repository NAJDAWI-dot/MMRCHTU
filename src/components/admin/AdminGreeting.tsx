import { adminGreeting } from "@/lib/admin-greeting";

/**
 * The first thing an admin sees after signing in.
 *
 * The wording is decided by `adminGreeting` in lib, which is where the hour
 * boundaries and the "we have no previous visit on record" case are handled.
 * This only draws it.
 *
 * The one place in the admin area that gets a decorative surface. The rest of
 * these screens are worked in for an hour at a time and want to be calm; a
 * dashboard opened once at the start of a shift can afford a moment.
 */
export function AdminGreeting({
  username,
  previousLoginAt,
  createdAt,
}: {
  username: string;
  previousLoginAt: Date | null;
  createdAt: Date;
}) {
  const { headline, detail } = adminGreeting(username, previousLoginAt, createdAt);
  const monogram = username.trim().charAt(0).toUpperCase() || "?";

  return (
    <section className="relative overflow-hidden rounded-xl border border-ras-purple/15 bg-[var(--color-surface)] p-6 shadow-sm dark:border-white/10 sm:p-8">
      {/* Decorative wash. aria-hidden and pointer-events-none so it is scenery
          and nothing more — it must never sit between a pointer and a control. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-ras-purple/10 via-transparent to-mood-orchid/10 dark:from-white/[0.06] dark:to-mood-orchid/10"
      />
      <div className="relative flex items-center gap-4 sm:gap-5">
        <span
          aria-hidden="true"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-ras-purple font-display text-xl font-extrabold text-white shadow-sm dark:bg-white/15 sm:h-14 sm:w-14 sm:text-2xl"
        >
          {monogram}
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-xl font-extrabold tracking-tight text-ras-purple dark:text-white sm:text-2xl">
            {headline}
          </h1>
          {detail ? (
            <p className="mt-1 text-sm text-ras-gray dark:text-white/70">{detail}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
