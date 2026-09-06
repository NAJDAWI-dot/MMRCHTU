import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { PaymentScreenshot } from "@/components/admin/PaymentScreenshot";
import { ReviewShortcuts } from "@/components/admin/ReviewShortcuts";
import { prisma } from "@/lib/prisma";
import { formatFils, paymentDelta } from "@/lib/payment";
import { rejectPayment, verifyPayment } from "../actions";

export const metadata: Metadata = {
  title: "Admin — Review payments",
};

/**
 * One payment at a time, until there are none left.
 *
 * The list page is the right shape for finding a particular team and the wrong
 * shape for working through everything that came in overnight: that meant
 * scrolling one enormous page, expanding a screenshot, comparing two figures
 * buried in a definition list, and scrolling on. Here the comparison is the
 * page, the screenshot is already open, and each decision moves to the next
 * team by itself.
 *
 * Only SUBMITTED rows are in the queue — those are the ones actually awaiting a
 * decision. Everything else is reachable from the list.
 */

/** Skipped ids ride in the URL, so the queue keeps no server-side state at all. */
function parseSkipped(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

function queueHref(skipped: readonly string[]): string {
  return skipped.length > 0
    ? `/admin/payments/review?skip=${skipped.map(encodeURIComponent).join(",")}`
    : "/admin/payments/review";
}

const FIELD =
  "w-full rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] transition-colors focus-visible:border-ras-purple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ras-purple/40 dark:focus-visible:border-white dark:focus-visible:ring-white/30";

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ras-gray dark:text-white/50">{label}</dt>
      <dd className="mt-0.5 text-ras-purple dark:text-white">{children}</dd>
    </div>
  );
}

export default async function ReviewPaymentsPage({
  searchParams,
}: {
  searchParams?: { skip?: string; error?: string };
}) {
  const skipped = parseSkipped(searchParams?.skip);

  const [team, waiting] = await Promise.all([
    prisma.registration.findFirst({
      where: {
        paymentStatus: "SUBMITTED",
        ...(skipped.length > 0 ? { id: { notIn: skipped } } : {}),
      },
      // Strict longest-wait-first, which is deliberately *not* the list's
      // order. The list floats mismatched payments to the top because it is
      // scanned; a queue is worked through to the end, so every row is seen
      // either way and the only thing left to get right is fairness.
      orderBy: [{ paymentSubmittedAt: "asc" }, { createdAt: "asc" }],
    }),
    prisma.registration.count({ where: { paymentStatus: "SUBMITTED" } }),
  ]);

  const backToList = (
    <Button asChild variant="ghost" size="sm">
      <Link href="/admin/payments">Back to the list</Link>
    </Button>
  );

  // Two different empty states, and they mean opposite things.
  if (!team) {
    const allSkipped = waiting > 0;
    return (
      <div>
        <AdminPageHeader title="Review payments" actions={backToList} />
        <Card className="mt-6 text-center">
          <p className="font-display text-lg font-bold text-ras-purple dark:text-white">
            {allSkipped ? "That is everything except what you skipped" : "Nothing waiting to be checked"}
          </p>
          <p className="mt-2 text-sm text-ras-gray dark:text-white/70">
            {allSkipped
              ? `You passed over ${skipped.length} ${skipped.length === 1 ? "payment" : "payments"} this time round.`
              : "Every reported payment has been either verified or refused."}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {allSkipped ? (
              <Button asChild size="sm">
                <Link href="/admin/payments/review">Go back over the skipped ones</Link>
              </Button>
            ) : null}
            {backToList}
          </div>
        </Card>
      </div>
    );
  }

  const delta = paymentDelta(team.feeDueFils, team.paymentAmountFils);
  // Each decision lands back here, minus the team just decided — it is no
  // longer SUBMITTED, so it drops out of the query on its own. The skip list
  // has to survive, or a skipped team would reappear immediately.
  const next = queueHref(skipped);
  const skipHref = queueHref([...skipped, team.id]);

  return (
    <div>
      <ReviewShortcuts />

      <AdminPageHeader
        title="Review payments"
        subtitle={`${waiting} still to check${skipped.length > 0 ? ` · ${skipped.length} skipped` : ""}`}
        actions={backToList}
      />

      {searchParams?.error === "note-required" ? (
        <p
          role="alert"
          className="mt-4 rounded-md border border-ras-crimson/30 bg-ras-crimson/5 p-3 text-sm font-semibold text-accent"
        >
          Say why it could not be matched — the team is shown this on their registration page.
        </p>
      ) : null}

      {/*
        Keyed by the team, and it matters.

        Every team in the queue is the same route, so a decision navigates
        without changing the URL and React reconciles this subtree rather than
        remounting it. Uncontrolled state then survives the move: the reason
        textarea below kept the previous team's note, and the screenshot kept
        whether it had been hidden. Rejecting one team with the reason written
        for the last one is the kind of bug nobody would catch by reading.
      */}
      <Card key={team.id} className="mt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-xl font-bold text-ras-purple dark:text-white">
              {team.teamName}
            </p>
            <p className="text-xs text-ras-gray dark:text-white/60">
              {team.submitterEmail}
              {team.resumeCode ? (
                <>
                  {" · code "}
                  <span className="font-mono font-semibold">{team.resumeCode}</span>
                </>
              ) : null}
            </p>
          </div>
          <p className="text-xs text-ras-gray dark:text-white/50">
            reported {team.paymentSubmittedAt?.toLocaleDateString() ?? "—"}
          </p>
        </div>

        {/* The comparison this whole page exists for, side by side and large,
            rather than two lines of a definition list. */}
        <dl className="mt-5 grid gap-4 sm:grid-cols-3">
          <Fact label="Quoted">
            <span className="font-display text-2xl font-extrabold">
              {team.feeDueFils !== null ? formatFils(team.feeDueFils) : "—"}
            </span>
          </Fact>
          <Fact label="Reported">
            <span
              className={`font-display text-2xl font-extrabold ${delta ? "text-accent" : ""}`}
            >
              {team.paymentAmountFils !== null ? formatFils(team.paymentAmountFils) : "—"}
            </span>
          </Fact>
          <Fact label="Reference">
            <span className="break-all font-mono text-sm">{team.paymentReference ?? "—"}</span>
          </Fact>
        </dl>

        {delta ? (
          <p role="alert" className="mt-3 text-sm font-semibold text-accent">
            {formatFils(delta.fils)} {delta.direction === "short" ? "short of" : "over"} the amount
            quoted. Check the statement before verifying.
          </p>
        ) : null}

        {team.paymentScreenshotUrl ? (
          <PaymentScreenshot
            registrationId={team.id}
            teamName={team.teamName}
            defaultOpen
          />
        ) : (
          <p className="mt-4 rounded-md border border-ras-gray/25 p-3 text-sm text-ras-gray dark:text-white/60">
            No screenshot was uploaded — there is only the reference above to go on.
          </p>
        )}
      </Card>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="font-semibold text-ras-purple dark:text-white">It matches</p>
          <p className="mt-1 text-xs text-ras-gray dark:text-white/70">
            Marks the fee received and moves to the next team.
          </p>
          <form action={verifyPayment} className="mt-3">
            <input type="hidden" name="id" value={team.id} />
            <input type="hidden" name="next" value={next} />
            <Button id="review-verify" type="submit" size="lg" className="w-full">
              Verify
            </Button>
          </form>
        </Card>

        <Card>
          <p className="font-semibold text-ras-purple dark:text-white">It does not</p>
          <form key={team.id} action={rejectPayment} className="mt-3">
            <input type="hidden" name="id" value={team.id} />
            <input type="hidden" name="next" value={next} />
            <label htmlFor="review-note" className="text-xs text-ras-gray dark:text-white/70">
              {/* Required in the browser and checked again on the server. The
                  team reads this on their own registration page, so a blank one
                  leaves them refused with no explanation. */}
              Why not? The team is shown this.
            </label>
            <textarea
              id="review-note"
              name="paymentNote"
              rows={2}
              required
              defaultValue={team.paymentNote ?? ""}
              placeholder="No transfer found under this reference."
              className={`mt-1 ${FIELD}`}
            />
            <Button type="submit" variant="destructive" size="sm" className="mt-2 w-full">
              Reject
            </Button>
          </form>
        </Card>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          id="review-skip"
          href={skipHref}
          className="inline-flex min-h-[44px] items-center rounded-md px-2 text-sm font-semibold text-ras-gray underline-offset-2 hover:text-ras-purple hover:underline dark:text-white/70 dark:hover:text-white"
        >
          Skip for now →
        </Link>

        {/* Shown, not just bound: a shortcut nobody is told about is one only
            the person who wrote it will ever press. */}
        <p className="text-xs text-ras-gray dark:text-white/50">
          <kbd className="rounded border border-ras-gray/30 px-1 font-mono dark:border-white/20">V</kbd>{" "}
          verify ·{" "}
          <kbd className="rounded border border-ras-gray/30 px-1 font-mono dark:border-white/20">R</kbd>{" "}
          reason ·{" "}
          <kbd className="rounded border border-ras-gray/30 px-1 font-mono dark:border-white/20">S</kbd>{" "}
          skip
        </p>
      </div>
    </div>
  );
}
