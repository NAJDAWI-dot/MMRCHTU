import type { Metadata } from "next";
import Link from "next/link";
import { ReadinessChecklist } from "@/components/rules/ReadinessChecklist";
import { getEarlyBirdState } from "@/lib/early-bird-server";

export const metadata: Metadata = {
  title: "Readiness checklist",
  description:
    "Check your team and your micromouse against the MMRC 26 rules before competition day.",
};

export default async function ChecklistPage() {
  // The checklist is a client component and cannot ask for itself — the answer
  // is fetched here and handed down. Cached for the request, and the Nav in the
  // layout has already asked, so this costs nothing.
  const earlyBird = await getEarlyBirdState();

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <p className="text-sm font-semibold text-accent dark:text-rose-300">
        <Link href="/rules" className="hover:underline">
          ← Rulebook
        </Link>
      </p>
      <h1 className="mt-2 font-display text-3xl font-extrabold text-ras-purple dark:text-white">
        Readiness checklist
      </h1>
      <p className="mt-3 text-ras-gray dark:text-white/70">
        Every point below comes straight from the rulebook. Work through it with your mouse in
        front of you — the ones marked <strong>Rule</strong> decide whether you can compete at
        all, and the ones marked <strong>Advice</strong> decide how well.
      </p>

      <div className="mt-8">
        <ReadinessChecklist earlyBird={earlyBird.active} />
      </div>
    </div>
  );
}
